import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('System')
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  @ApiOperation({ summary: 'Liveness health check - chỉ kiểm tra tiến trình Node.js' })
  @ApiResponse({ status: 200, description: 'Tiến trình đang hoạt động bình thường' })
  checkHealth(): { status: string; service: string; timestamp: string; uptime: number } {
    return {
      status: 'alive',
      service: 'customer-service',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe - kiểm tra kết nối cơ sở dữ liệu' })
  @ApiResponse({ status: 200, description: 'Dịch vụ đã sẵn sàng tiếp nhận lưu lượng' })
  @ApiResponse({ status: 503, description: 'Cơ sở dữ liệu mất kết nối' })
  async checkReady(): Promise<{
    status: string;
    service: string;
    timestamp: string;
    checks: Record<string, string>;
  }> {
    const checks: Record<string, string> = {};
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'up';
      return {
        status: 'ready',
        service: 'customer-service',
        timestamp: new Date().toISOString(),
        checks,
      };
    } catch (error) {
      checks.database = 'down';
      throw new ServiceUnavailableException({
        status: 'not_ready',
        service: 'customer-service',
        timestamp: new Date().toISOString(),
        checks,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
