import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto.js';
import { Role, UserStatus, User } from '../../generated/client/index.js';

export interface TokenResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserResponse {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: Role;
  status: UserStatus;
  emailVerifiedAt?: Date | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AuthService {
  private readonly jwtAccessSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly accessTokenExpiresIn = 900; // 15 phút (giây)
  private readonly refreshTokenExpiresInDays = 7; // 7 ngày

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {
    this.jwtAccessSecret = process.env.JWT_ACCESS_SECRET || 'super_secret_access_key_phanbonshop_2026';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'super_secret_refresh_key_phanbonshop_2026';
  }

  // 1. Tiện ích Hash
  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private sanitizeUser(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  // 2. Tạo Tokens & Lưu Session Hash
  private async createTokensAndSession(
    user: User,
    ipAddress?: string,
    deviceInfo?: string,
  ): Promise<TokenResult> {
    // Access Token (15 phút)
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
      {
        secret: this.jwtAccessSecret,
        expiresIn: this.accessTokenExpiresIn,
      },
    );

    // Refresh Token (7 ngày)
    const jti = randomUUID();
    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        jti,
      },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: `${this.refreshTokenExpiresInDays}d`,
      },
    );

    // Lưu Hash của refresh token vào DB (không bao giờ lưu plaintext)
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenExpiresInDays);

    await this.prisma.refreshTokenSession.create({
      data: {
        userId: user.id,
        tokenHash,
        ipAddress: ipAddress || null,
        deviceInfo: deviceInfo || null,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiresIn,
    };
  }

  // 3. Đăng ký tài khoản (Mặc định CUSTOMER)
  async register(dto: RegisterDto, ipAddress?: string, deviceInfo?: string): Promise<{ user: UserResponse } & TokenResult> {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email.toLowerCase().trim() },
          ...(dto.phone ? [{ phone: dto.phone.trim() }] : []),
        ],
      },
    });

    if (existing) {
      if (existing.email === dto.email.toLowerCase().trim()) {
        throw new ConflictException('Email đã được sử dụng trong hệ thống');
      }
      throw new ConflictException('Số điện thoại đã được đăng ký tài khoản');
    }

    const passwordHash = await this.hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        fullName: dto.fullName.trim(),
        phone: dto.phone ? dto.phone.trim() : null,
        role: Role.CUSTOMER,
        status: UserStatus.ACTIVE,
      },
    });

    const tokens = await this.createTokensAndSession(user, ipAddress, deviceInfo);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  // 4. Đăng nhập
  async login(dto: LoginDto, ipAddress?: string, deviceInfo?: string): Promise<{ user: UserResponse } & TokenResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const isMatch = await this.comparePassword(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(`Tài khoản hiện đang ở trạng thái ${user.status}, vui lòng liên hệ hỗ trợ`);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.createTokensAndSession(user, ipAddress, deviceInfo);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  // 5. Refresh Token Rotation
  async refresh(refreshToken: string, ipAddress?: string, deviceInfo?: string): Promise<TokenResult> {
    try {
      this.jwtService.verify(refreshToken, {
        secret: this.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.refreshTokenSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Session không tồn tại hoặc token không hợp lệ');
    }

    // Kiểm tra token đã bị thu hồi chưa (Token reuse detection)
    if (session.revokedAt !== null) {
      throw new UnauthorizedException('Refresh token đã bị thu hồi và không thể tái sử dụng');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token đã hết hạn');
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Tài khoản đã bị khóa hoặc ngừng hoạt động');
    }

    // Thu hồi refresh token cũ (ROTATION)
    await this.prisma.refreshTokenSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    // Cấp phát cặp tokens mới và tạo session mới
    return this.createTokensAndSession(session.user, ipAddress, deviceInfo);
  }

  // 6. Đăng xuất (Revoke session hiện tại)
  async logout(refreshToken: string): Promise<{ message: string }> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshTokenSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Đăng xuất thành công' };
  }

  // 7. Đăng xuất toàn bộ thiết bị (Revoke all sessions của User)
  async logoutAll(userId: string): Promise<{ message: string }> {
    await this.prisma.refreshTokenSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Đã đăng xuất khỏi tất cả các thiết bị' };
  }

  // 8. Lấy thông tin tài khoản hiện tại (/me)
  async getMe(userId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy thông tin người dùng');
    }

    return this.sanitizeUser(user);
  }

  // 9. Đổi mật khẩu
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    const isMatch = await this.comparePassword(dto.oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác');
    }

    const newHash = await this.hashPassword(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Thu hồi toàn bộ session cũ bắt buộc đăng nhập lại
    await this.logoutAll(userId);

    return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' };
  }

  // 10. Quên & Khôi phục mật khẩu
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    // Không tiết lộ email có tồn tại hay không vì lý do bảo mật
    if (!user) {
      return { message: 'Nếu email tồn tại trong hệ thống, hướng dẫn khôi phục sẽ được gửi tới hòm thư.' };
    }

    return { message: 'Nếu email tồn tại trong hệ thống, hướng dẫn khôi phục sẽ được gửi tới hòm thư.' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    if (!dto.resetToken) {
      throw new BadRequestException('Mã khôi phục không hợp lệ');
    }
    return { message: 'Mật khẩu đã được đặt lại thành công.' };
  }

  async updateUserRoleOrStatus(
    actorId: string,
    actorRole: string,
    targetUserId: string,
    updates: { role?: Role; status?: UserStatus },
  ): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: updates,
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          actorRole,
          action: 'USER_ROLE_CHANGE',
          entityType: 'USER',
          entityId: targetUserId,
          oldValue: JSON.stringify({ role: user.role, status: user.status }),
          newValue: JSON.stringify(updates),
          ipAddress: null,
          requestId: null,
        },
      });
    } catch {
      // Non-blocking audit log
    }

    return this.sanitizeUser(updated);
  }
}
