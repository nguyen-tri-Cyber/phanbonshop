import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto.js';
import { GoogleLoginDto } from './dto/google-login.dto.js';
import { IdentityProvider, Role, UserStatus, User } from '../../generated/client/index.js';
import { getEnvString } from '@phanbonshop/config';
import { EmailService } from '../email/email.service.js';
import { createLogger } from '@phanbonshop/logger';
import { GoogleIdentityVerifier } from '../google/google-identity.verifier.js';

const logger = createLogger('auth-service:auth');

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
  private readonly resetTokenExpiresInMinutes = 15; // 15 phút

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly googleIdentityVerifier: GoogleIdentityVerifier,
  ) {
    this.jwtAccessSecret = getEnvString('JWT_ACCESS_SECRET');
    this.jwtRefreshSecret = getEnvString('JWT_REFRESH_SECRET');
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
  async register(
    dto: RegisterDto,
    ipAddress?: string,
    deviceInfo?: string,
  ): Promise<{ user: UserResponse } & TokenResult> {
    const hasGoogleIdentity = Boolean(process.env.GOOGLE_CLIENT_ID?.trim());
    if (hasGoogleIdentity || process.env.REQUIRE_GOOGLE_REGISTRATION === 'true') {
      throw new ForbiddenException(
        'Đăng ký bằng email và mật khẩu đã tạm khóa. Vui lòng xác minh bằng tài khoản Gmail.',
      );
    }

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
  async login(
    dto: LoginDto,
    ipAddress?: string,
    deviceInfo?: string,
  ): Promise<{ user: UserResponse } & TokenResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Tài khoản này sử dụng đăng nhập Google');
    }

    const isMatch = await this.comparePassword(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        `Tài khoản hiện đang ở trạng thái ${user.status}, vui lòng liên hệ hỗ trợ`,
      );
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

  async loginWithGoogle(
    dto: GoogleLoginDto,
    ipAddress?: string,
    deviceInfo?: string,
  ): Promise<{ user: UserResponse } & TokenResult> {
    const identity = await this.googleIdentityVerifier.verify(dto.credential);
    let user = await this.findUserByGoogleSubject(identity.subject);

    if (!user) {
      try {
        user = await this.prisma.$transaction(async (tx) => {
          const existingIdentity = await tx.externalIdentity.findUnique({
            where: {
              provider_providerSubject: {
                provider: IdentityProvider.GOOGLE,
                providerSubject: identity.subject,
              },
            },
            include: { user: true },
          });
          if (existingIdentity) return existingIdentity.user;

          let resolvedUser = await tx.user.findUnique({ where: { email: identity.email } });
          if (resolvedUser) {
            if (resolvedUser.role !== Role.CUSTOMER) {
              throw new ForbiddenException(
                'Tài khoản nhân viên hoặc quản trị không được tự động liên kết Google',
              );
            }
            resolvedUser = await tx.user.update({
              where: { id: resolvedUser.id },
              data: { emailVerifiedAt: resolvedUser.emailVerifiedAt || new Date() },
            });
          } else {
            resolvedUser = await tx.user.create({
              data: {
                email: identity.email,
                passwordHash: null,
                fullName: identity.fullName,
                role: Role.CUSTOMER,
                status: UserStatus.ACTIVE,
                emailVerifiedAt: new Date(),
              },
            });
          }

          await tx.externalIdentity.create({
            data: {
              userId: resolvedUser.id,
              provider: IdentityProvider.GOOGLE,
              providerSubject: identity.subject,
              providerEmail: identity.email,
              displayName: identity.fullName,
              avatarUrl: identity.avatarUrl,
            },
          });
          return resolvedUser;
        });
      } catch (error: unknown) {
        if (!this.isUniqueConstraintError(error)) throw error;
        user = await this.findUserByGoogleSubject(identity.subject);
        if (!user) throw error;
      }
    }

    if (user.role !== Role.CUSTOMER) {
      throw new ForbiddenException(
        'Tài khoản nhân viên hoặc quản trị không được đăng nhập qua Google',
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Tài khoản đã bị khóa hoặc ngừng hoạt động');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    const tokens = await this.createTokensAndSession(updatedUser, ipAddress, deviceInfo);
    return { user: this.sanitizeUser(updatedUser), ...tokens };
  }

  private async findUserByGoogleSubject(subject: string): Promise<User | null> {
    const identity = await this.prisma.externalIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: IdentityProvider.GOOGLE,
          providerSubject: subject,
        },
      },
      include: { user: true },
    });
    return identity?.user || null;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
  }

  // 5. Refresh Token Rotation
  async refresh(
    refreshToken: string,
    ipAddress?: string,
    deviceInfo?: string,
  ): Promise<TokenResult> {
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

    // Kiểm tra token đã bị thu hồi chưa (Token reuse detection -> Batch Revoke Token Family)
    if (session.revokedAt !== null) {
      logger.warn(
        `Phát hiện tái sử dụng Refresh Token đã thu hồi (Token Reuse)! Thu hồi toàn bộ Token Family của user ${session.userId}.`,
        { userId: session.userId, sessionId: session.id, ipAddress },
      );

      // Batch revoke toàn bộ refresh tokens còn lại của user (RFC 6819 Token Family Invalidation)
      await this.prisma.refreshTokenSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      throw new UnauthorizedException(
        'Phát hiện token đã bị thu hồi. Toàn bộ phiên đăng nhập đã bị hủy vì lý do bảo mật.',
      );
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

    if (!user.passwordHash) {
      throw new BadRequestException('Tài khoản Google chưa thiết lập mật khẩu cục bộ');
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

  // 10. Quên mật khẩu (Production-Grade)
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const genericMessage =
      'Nếu email tồn tại trong hệ thống, hướng dẫn khôi phục sẽ được gửi tới hòm thư.';
    const normalizedEmail = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Không tiết lộ email có tồn tại hay không (chống Email Enumeration)
    if (!user) {
      return { message: genericMessage };
    }

    // Invalidate tất cả reset tokens cũ chưa sử dụng của user
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    // Tạo cryptographically secure random token
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.resetTokenExpiresInMinutes * 60 * 1000);

    // Lưu hash vào DB (KHÔNG BAO GIỜ lưu plaintext token)
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Gửi email khôi phục
    await this.emailService.sendPasswordReset(user.email, rawToken, {
      fullName: user.fullName,
    });

    return { message: genericMessage };
  }

  // 11. Đặt lại mật khẩu (Production-Grade, Atomic Transaction)
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    if (!dto.resetToken) {
      throw new BadRequestException('Mã khôi phục không hợp lệ');
    }

    // Hash token gửi lên từ client để tìm kiếm trong DB
    const tokenHash = this.hashToken(dto.resetToken);

    const resetTokenRecord = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    // Kiểm tra token tồn tại
    if (!resetTokenRecord) {
      throw new BadRequestException('Mã khôi phục không hợp lệ hoặc đã hết hạn');
    }

    // Kiểm tra token đã sử dụng chưa
    if (resetTokenRecord.usedAt !== null) {
      throw new BadRequestException('Mã khôi phục đã được sử dụng');
    }

    // Kiểm tra token đã hết hạn chưa
    if (resetTokenRecord.expiresAt < new Date()) {
      throw new BadRequestException('Mã khôi phục đã hết hạn');
    }

    // Kiểm tra trạng thái tài khoản
    if (resetTokenRecord.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Tài khoản hiện đang không hoạt động, vui lòng liên hệ hỗ trợ');
    }

    // Băm mật khẩu mới (bcrypt, salt rounds 12)
    const newPasswordHash = await this.hashPassword(dto.newPassword);

    // Thực thi giao dịch nguyên tử (Atomic Transaction)
    await this.prisma.$transaction([
      // 1. Cập nhật mật khẩu user
      this.prisma.user.update({
        where: { id: resetTokenRecord.userId },
        data: { passwordHash: newPasswordHash },
      }),

      // 2. Đánh dấu token đã sử dụng
      this.prisma.passwordResetToken.update({
        where: { id: resetTokenRecord.id },
        data: { usedAt: new Date() },
      }),

      // 3. Thu hồi toàn bộ RefreshTokenSession đang hoạt động
      this.prisma.refreshTokenSession.updateMany({
        where: { userId: resetTokenRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),

      // 4. Ghi nhật ký kiểm toán (Audit Log)
      this.prisma.auditLog.create({
        data: {
          actorId: resetTokenRecord.userId,
          actorRole: resetTokenRecord.user.role,
          action: 'PASSWORD_RESET',
          entityType: 'USER',
          entityId: resetTokenRecord.userId,
          oldValue: null,
          newValue: JSON.stringify({ reason: 'Password reset via token' }),
          ipAddress: null,
          requestId: null,
        },
      }),
    ]);

    return {
      message: 'Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại với mật khẩu mới.',
    };
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
