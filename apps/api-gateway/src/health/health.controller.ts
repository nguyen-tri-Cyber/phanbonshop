import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('System')
@Controller()
export class HealthController {
  @Get('health')
  @ApiOperation({ summary: 'Kiểm tra liveness của API Gateway' })
  @ApiResponse({ status: 200, description: 'Dịch vụ đang chạy bình thường' })
  checkHealth(): { status: string; service: string; timestamp: string; uptime: number } {
    return {
      status: 'alive',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Kiểm tra readiness của API Gateway' })
  @ApiResponse({ status: 200, description: 'Dịch vụ đã sẵn sàng tiếp nhận traffic' })
  checkReady(): { status: string; timestamp: string; uptime: number } {
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }
}
