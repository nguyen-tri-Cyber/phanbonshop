import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CompensationTask,
  CompensationTaskStatus,
  CompensationTaskType,
} from '../../generated/client/index.js';
import { createLogger } from '@phanbonshop/logger';
import { getEnvString, getServiceUrl, CANONICAL_PORTS } from '@phanbonshop/config';
import crypto from 'node:crypto';

const logger = createLogger('order-service:compensation');

export interface ReleaseInventoryPayload {
  reservationId: string;
  reason: string;
  requestId?: string;
}

export interface CommitInventoryPayload {
  reservationId: string;
  referenceId: string;
  requestId?: string;
  orderId?: string;
  paymentAttemptId?: string;
  providerTransactionId?: string;
}

@Injectable()
export class CompensationService implements OnModuleInit, OnModuleDestroy {
  private readonly inventoryServiceUrl = getServiceUrl(
    'INVENTORY_SERVICE_URL',
    CANONICAL_PORTS.INVENTORY_SERVICE,
  );
  private readonly internalSecret = getEnvString('INTERNAL_SERVICE_SECRET');
  private workerTimer: NodeJS.Timeout | null = null;
  private workerRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // 1. Phục hồi các task bị treo do crash trước đó
    try {
      await this.recoverStaleProcessingTasks();
    } catch (err) {
      logger.error('Lỗi khi phục hồi stale processing tasks lúc khởi động:', err);
    }

    // 2. Kích hoạt worker chạy định kỳ
    const intervalMs = Number(process.env.COMPENSATION_WORKER_INTERVAL_MS) || 5000;
    this.workerTimer = setInterval(async () => {
      if (this.workerRunning) return;
      this.workerRunning = true;
      try {
        await this.recoverStaleProcessingTasks();
        await this.processPendingTasks();
      } catch (err) {
        logger.error('Lỗi khi worker xử lý compensation tasks định kỳ:', err);
      } finally {
        this.workerRunning = false;
      }
    }, intervalMs);

    if (this.workerTimer && typeof this.workerTimer.unref === 'function') {
      this.workerTimer.unref();
    }
  }

  onModuleDestroy() {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
    }
  }

  /**
   * Tạo một nhiệm vụ bồi hoàn (CompensationTask) bền vững trong database
   */
  async createTask(
    type: CompensationTaskType,
    payload: ReleaseInventoryPayload | Record<string, unknown>,
    options?: { maxRetries?: number },
  ): Promise<CompensationTask> {
    const task = await this.prisma.compensationTask.create({
      data: {
        type,
        payload: JSON.stringify(payload),
        status: CompensationTaskStatus.PENDING,
        maxRetries: options?.maxRetries ?? 5,
        nextAttemptAt: new Date(),
      },
    });

    const reservationId = (payload as ReleaseInventoryPayload)?.reservationId || 'N/A';
    logger.warn('Đã khởi tạo CompensationTask bền vững trong DB', {
      taskId: task.id,
      type,
      reservationId,
      status: CompensationTaskStatus.PENDING,
    });

    return task;
  }

  /**
   * Worker Processor: Quét và thực thi các CompensationTask ở trạng thái PENDING
   * Sử dụng Atomic Claim chống duplicate execution giữa các worker chạy song song.
   */
  async processPendingTasks(limit = 20): Promise<{ processed: number; succeeded: number; failed: number }> {
    const tasks = await this.prisma.compensationTask.findMany({
      where: {
        status: CompensationTaskStatus.PENDING,
        nextAttemptAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let succeeded = 0;
    let failed = 0;

    for (const task of tasks) {
      // 1. Atomic Claim: Chỉ worker nào cập nhật thành công PENDING -> PROCESSING mới được xử lý
      const claim = await this.prisma.compensationTask.updateMany({
        where: {
          id: task.id,
          status: CompensationTaskStatus.PENDING,
        },
        data: {
          status: CompensationTaskStatus.PROCESSING,
          updatedAt: new Date(),
        },
      });

      if (claim.count === 0) {
        // Worker khác đã claim task này trước đó
        continue;
      }

      const success = await this.executeTask(task);
      if (success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return { processed: succeeded + failed, succeeded, failed };
  }

  /**
   * Thực thi một nhiệm vụ bồi hoàn cụ thể
   */
  async executeTask(task: CompensationTask): Promise<boolean> {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(task.payload) as Record<string, unknown>;
    } catch {
      payload = { reservationId: 'invalid-payload', reason: 'JSON parse error' };
    }

    const requestId = String(
      payload.requestId || `comp-${crypto.randomUUID().slice(0, 8)}`,
    );
    const reservationId = String(payload.reservationId || '');
    const currentAttempt = task.retryCount + 1;

    logger.info('Đang xử lý CompensationTask', {
      taskId: task.id,
      requestId,
      reservationId,
      attempt: currentAttempt,
      maxRetries: task.maxRetries,
    });

    let success = false;
    let errorMessage: string | null = null;

    try {
      if (task.type === CompensationTaskType.RELEASE_INVENTORY) {
        success = await this.callInventoryRelease(
          reservationId,
          String(payload.reason || 'Compensation release'),
          requestId,
        );
        if (!success) {
          errorMessage = 'Inventory Service trả về phản hồi không thành công (non-2xx)';
        }
      } else if (task.type === CompensationTaskType.COMMIT_INVENTORY) {
        success = await this.callInventoryCommit(
          reservationId,
          String(payload.referenceId || ''),
          requestId,
        );
        if (!success) {
          errorMessage = 'Inventory Service trả về phản hồi commit không thành công (non-2xx)';
        }
      }
    } catch (err) {
      success = false;
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    if (success) {
      await this.prisma.compensationTask.update({
        where: { id: task.id },
        data: {
          status: CompensationTaskStatus.COMPLETED,
          completedAt: new Date(),
          lastError: null,
        },
      });

      logger.info('CompensationTask hoàn tất thành công', {
        taskId: task.id,
        requestId,
        reservationId,
        attempt: currentAttempt,
      });

      return true;
    }

    // Xử lý Thất bại: Exponential Backoff hoặc Dead-letter
    const nextRetryCount = currentAttempt;
    const isDeadLetter = nextRetryCount >= task.maxRetries;
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s... tối đa 60s
    const delayMs = Math.min(60000, 1000 * Math.pow(2, nextRetryCount));
    const nextAttemptAt = new Date(Date.now() + delayMs);

    await this.prisma.compensationTask.update({
      where: { id: task.id },
      data: {
        status: isDeadLetter ? CompensationTaskStatus.FAILED : CompensationTaskStatus.PENDING,
        retryCount: nextRetryCount,
        nextAttemptAt,
        lastError: errorMessage,
      },
    });

    if (isDeadLetter) {
      logger.error('CompensationTask đã đạt số lần thử tối đa và chuyển sang FAILED (Dead Letter)', {
        taskId: task.id,
        requestId,
        reservationId,
        attempt: nextRetryCount,
        maxRetries: task.maxRetries,
        lastError: errorMessage,
      });
    } else {
      logger.warn('CompensationTask thất bại, đã lên lịch thử lại theo Exponential Backoff', {
        taskId: task.id,
        requestId,
        reservationId,
        attempt: nextRetryCount,
        nextAttemptAt: nextAttemptAt.toISOString(),
        lastError: errorMessage,
      });
    }

    return false;
  }

  /**
   * Gọi API giải phóng tồn kho của Inventory Service (chống lỗi nuốt non-2xx)
   */
  async callInventoryRelease(
    reservationId: string,
    reason: string,
    requestId?: string,
  ): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${this.inventoryServiceUrl}/internal/v1/inventory/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': this.internalSecret,
          ...(requestId ? { 'X-Request-Id': requestId } : {}),
        },
        body: JSON.stringify({ reservationId, reason }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        logger.error('Inventory Service từ chối release tồn kho', {
          reservationId,
          statusCode: res.status,
          errorText,
        });
        return false;
      }

      return true;
    } catch (err) {
      logger.error('Lỗi kết nối tới Inventory Service khi release:', {
        reservationId,
        error: String(err),
      });
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Commit is idempotent in inventory-service, so durable worker retries are safe. */
  async callInventoryCommit(
    reservationId: string,
    referenceId: string,
    requestId?: string,
  ): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${this.inventoryServiceUrl}/internal/v1/inventory/commit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': this.internalSecret,
          ...(requestId ? { 'X-Request-Id': requestId } : {}),
        },
        body: JSON.stringify({ reservationId, referenceId }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        logger.error('INVENTORY_COMMIT_FAILED', undefined, {
          reservationId,
          referenceId,
          requestId,
          statusCode: res.status,
          errorText,
        });
        return false;
      }

      logger.info('INVENTORY_COMMIT_SUCCESS', {
        reservationId,
        referenceId,
        requestId,
      });
      return true;
    } catch (err) {
      logger.error('INVENTORY_COMMIT_FAILED', err, {
        reservationId,
        referenceId,
        requestId,
      });
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Phục hồi các nhiệm vụ bị kẹt ở trạng thái PROCESSING quá lâu (do server crash)
   */
  async recoverStaleProcessingTasks(olderThanMs = 120_000): Promise<number> {
    const staleThreshold = new Date(Date.now() - olderThanMs);
    const result = await this.prisma.compensationTask.updateMany({
      where: {
        status: CompensationTaskStatus.PROCESSING,
        updatedAt: { lt: staleThreshold },
      },
      data: {
        status: CompensationTaskStatus.PENDING,
        nextAttemptAt: new Date(),
      },
    });

    if (result.count > 0) {
      logger.warn(`Đã phục hồi ${result.count} CompensationTask bị kẹt PROCESSING về PENDING.`);
    }

    return result.count;
  }

  /**
   * Admin / Internal Visibility: Lấy danh sách nhiệm vụ bồi hoàn phục vụ giám sát
   */
  async getTasks(filter?: {
    status?: CompensationTaskStatus;
    type?: CompensationTaskType;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(filter?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: { status?: CompensationTaskStatus; type?: CompensationTaskType } = {};
    if (filter?.status) where.status = filter.status;
    if (filter?.type) where.type = filter.type;

    const [items, total] = await Promise.all([
      this.prisma.compensationTask.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.compensationTask.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
