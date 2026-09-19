import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Ip,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService, UserResponse, TokenResult } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { Roles } from './decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from './decorators/current-user.decorator.js';
import { Role } from '../../generated/client/index.js';

@ApiTags('Authentication')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản khách hàng mới' })
  @ApiResponse({ status: 201, description: 'Đăng ký thành công' })
  async register(
    @Body() dto: RegisterDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<{ user: UserResponse } & TokenResult> {
    return this.authService.register(dto, ipAddress, userAgent);
  }

  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập vào hệ thống' })
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công' })
  async login(
    @Body() dto: LoginDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<{ user: UserResponse } & TokenResult> {
    return this.authService.login(dto, ipAddress, userAgent);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Làm mới Access Token thông qua Refresh Token Rotation' })
  @ApiResponse({ status: 200, description: 'Cấp phát token mới thành công' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<TokenResult> {
    const token = dto.refreshToken || req.cookies?.refresh_token;
    return this.authService.refresh(token, ipAddress, userAgent);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Đăng xuất và thu hồi Refresh Token hiện tại' })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const token = dto.refreshToken || req.cookies?.refresh_token;
    return this.authService.logout(token);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng xuất khỏi toàn bộ các thiết bị' })
  @ApiResponse({ status: 200, description: 'Thu hồi toàn bộ phiên đăng nhập' })
  async logoutAll(@CurrentUser('userId') userId: string): Promise<{ message: string }> {
    return this.authService.logoutAll(userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin tài khoản đang đăng nhập' })
  @ApiResponse({ status: 200, description: 'Thông tin tài khoản' })
  async getMe(@CurrentUser('userId') userId: string): Promise<UserResponse> {
    return this.authService.getMe(userId);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đổi mật khẩu người dùng' })
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(userId, dto);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Yêu cầu khôi phục mật khẩu qua email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Đặt lại mật khẩu với token khôi phục' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    return this.authService.resetPassword(dto);
  }

  @Get('admin-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Endpoint mẫu chỉ dành riêng cho ADMIN và SUPER_ADMIN' })
  @ApiResponse({ status: 200, description: 'Quyền quản trị viên hợp lệ' })
  @ApiResponse({ status: 403, description: 'Từ chối truy cập (Forbidden)' })
  adminOnlySample(@CurrentUser() user: AuthenticatedUser): { message: string; user: AuthenticatedUser } {
    return {
      message: 'Xin chào Quản trị viên, bạn có toàn quyền truy cập khu vực này!',
      user,
    };
  }
}
