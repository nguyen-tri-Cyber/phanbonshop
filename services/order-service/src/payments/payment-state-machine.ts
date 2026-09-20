import { BadRequestException } from '@nestjs/common';
import { PaymentStatus, PaymentTransactionStatus } from '../../generated/client/index.js';

export const ALLOWED_PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [
    PaymentStatus.PROCESSING,
    PaymentStatus.PAID,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
    PaymentStatus.EXPIRED,
  ],
  [PaymentStatus.PROCESSING]: [
    PaymentStatus.PAID,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
    PaymentStatus.EXPIRED,
  ],
  [PaymentStatus.PAID]: [
    PaymentStatus.REFUNDED,
    PaymentStatus.PARTIALLY_REFUNDED,
  ],
  [PaymentStatus.PARTIALLY_REFUNDED]: [
    PaymentStatus.REFUNDED,
  ],
  [PaymentStatus.FAILED]: [],
  [PaymentStatus.CANCELLED]: [],
  [PaymentStatus.EXPIRED]: [],
  [PaymentStatus.REFUNDED]: [],
};

export const ALLOWED_TRANSACTION_TRANSITIONS: Record<
  PaymentTransactionStatus,
  readonly PaymentTransactionStatus[]
> = {
  [PaymentTransactionStatus.PENDING]: [
    PaymentTransactionStatus.SUCCESS,
    PaymentTransactionStatus.FAILED,
    PaymentTransactionStatus.EXPIRED,
  ],
  [PaymentTransactionStatus.SUCCESS]: [],
  [PaymentTransactionStatus.FAILED]: [],
  [PaymentTransactionStatus.EXPIRED]: [],
};

/**
 * State Machine chuẩn hóa quản lý các chuyển đổi trạng thái thanh toán và giao dịch
 * Đảm bảo tính toàn vẹn dữ liệu, chống race condition và hỗ trợ kiểm thử độc lập
 */
export class PaymentStateMachine {
  /**
   * Kiểm tra tính hợp lệ của bước chuyển trạng thái thanh toán
   */
  static canTransition(current: PaymentStatus, target: PaymentStatus): boolean {
    if (current === target) return true;
    const allowed = ALLOWED_PAYMENT_TRANSITIONS[current] || [];
    return allowed.includes(target);
  }

  /**
   * Xác thực chuyển đổi trạng thái, ném BadRequestException nếu không hợp lệ
   */
  static assertTransition(current: PaymentStatus, target: PaymentStatus): void {
    if (!this.canTransition(current, target)) {
      const allowed = ALLOWED_PAYMENT_TRANSITIONS[current] || [];
      throw new BadRequestException(
        `Chuyển đổi trạng thái thanh toán không hợp lệ: Không thể chuyển từ "${current}" sang "${target}". Các trạng thái hợp lệ tiếp theo: [${allowed.join(', ') || 'NONE'}]`,
      );
    }
  }

  /**
   * Kiểm tra tính hợp lệ của bước chuyển trạng thái giao dịch
   */
  static canTransitionTransaction(
    current: PaymentTransactionStatus,
    target: PaymentTransactionStatus,
  ): boolean {
    if (current === target) return true;
    const allowed = ALLOWED_TRANSACTION_TRANSITIONS[current] || [];
    return allowed.includes(target);
  }

  /**
   * Xác thực chuyển đổi giao dịch, ném BadRequestException nếu không hợp lệ
   */
  static assertTransactionTransition(
    current: PaymentTransactionStatus,
    target: PaymentTransactionStatus,
  ): void {
    if (!this.canTransitionTransaction(current, target)) {
      const allowed = ALLOWED_TRANSACTION_TRANSITIONS[current] || [];
      throw new BadRequestException(
        `Chuyển đổi trạng thái giao dịch không hợp lệ: Không thể chuyển từ "${current}" sang "${target}". Các trạng thái hợp lệ tiếp theo: [${allowed.join(', ') || 'NONE'}]`,
      );
    }
  }

  /**
   * Kiểm tra xem trạng thái thanh toán đã là trạng thái kết thúc (Terminal) chưa
   */
  static isTerminalStatus(status: PaymentStatus): boolean {
    return (
      status === PaymentStatus.FAILED ||
      status === PaymentStatus.CANCELLED ||
      status === PaymentStatus.EXPIRED ||
      status === PaymentStatus.REFUNDED
    );
  }

  /**
   * Kiểm tra xem giao dịch thanh toán đã hoàn tất thành công chưa
   */
  static isSuccessStatus(status: PaymentStatus): boolean {
    return status === PaymentStatus.PAID;
  }

  /**
   * Xác định có cần kích hoạt cam kết trừ kho vật lý (Commit Inventory) hay không
   */
  static shouldCommitInventory(targetStatus: PaymentStatus): boolean {
    return targetStatus === PaymentStatus.PAID;
  }

  /**
   * Xác định có cần giải phóng giữ chỗ kho (Release Reservation) hay không
   */
  static shouldReleaseInventory(targetStatus: PaymentStatus): boolean {
    return (
      targetStatus === PaymentStatus.FAILED ||
      targetStatus === PaymentStatus.EXPIRED ||
      targetStatus === PaymentStatus.CANCELLED
    );
  }
}
