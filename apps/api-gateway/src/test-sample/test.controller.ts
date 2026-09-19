import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SampleEchoDto } from './test.dto.js';

@ApiTags('Test Sample')
@Controller('api/v1')
export class TestController {
  @Get('ping')
  @ApiOperation({ summary: 'Kiểm tra kết nối ping-pong' })
  @ApiResponse({ status: 200, description: 'Phản hồi pong' })
  ping(): { message: string } {
    return { message: 'pong' };
  }

  @Post('test/echo')
  @ApiOperation({ summary: 'Echo dữ liệu và kiểm tra ValidationPipe' })
  @ApiResponse({ status: 200, description: 'Dữ liệu echo hợp lệ' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ (Validation Error)' })
  echo(@Body() body: SampleEchoDto): { received: SampleEchoDto; processedAt: string } {
    return {
      received: body,
      processedAt: new Date().toISOString(),
    };
  }

  @Get('internal/secret')
  @ApiOperation({ summary: 'Endpoint nội bộ phục vụ kiểm tra InternalGuardMiddleware' })
  internalSecret(): { status: string; data: string } {
    return {
      status: 'success',
      data: 'Đây là dữ liệu nội bộ được bảo vệ',
    };
  }
}
