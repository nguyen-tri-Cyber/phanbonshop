import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('System')
@Controller()
export class HealthController {
  @Get('health')
  @ApiOperation({ summary: 'Liveness health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  checkHealth(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'content-service',
      timestamp: new Date().toISOString(),
    };
  }
}
