import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { AuthService } from '../dist/auth/auth.service.js';
import { EmailService } from '../dist/email/email.service.js';
import { DevEmailProvider } from '../dist/email/dev-email.provider.js';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';

// ============================================================================
// SAFETY GUARD: Section 9 - Test Database Safety
// ============================================================================
const TEST_AUTH_DB_URL =
  process.env.AUTH_DATABASE_URL ||
  'mysql://phanbon_user:phanbon_secret@127.0.0.1:3307/test_auth_db';

if (!TEST_AUTH_DB_URL.includes('test_auth_db')) {
  throw new Error('[FATAL] Safety Check Failed: Auth integration tests MUST run on test_auth_db.');
}

process.env.NODE_ENV = 'test';
process.env.AUTH_DATABASE_URL = TEST_AUTH_DB_URL;
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'test_jwt_access_secret_super_secure_2026';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret_super_secure_2026';

describe('Phase 1.6 — Auth Critical Flows Integration Tests (Real MySQL test_auth_db)', () => {
  let prisma;
  let authService;
  let devEmailProvider;
  let googleIdentity;

  before(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const jwtService = new JwtService();
    devEmailProvider = new DevEmailProvider();
    const emailService = new EmailService(devEmailProvider);

    googleIdentity = null;
    authService = new AuthService(prisma, jwtService, emailService, {
      verify: async () => googleIdentity,
    });
  });

  after(async () => {
    if (prisma) await prisma.$disconnect();
  });

  beforeEach(async () => {
    devEmailProvider.lastSentToken = null;
    devEmailProvider.lastSentEmail = null;

    // Clean test tables
    await prisma.auditLog.deleteMany({});
    await prisma.passwordResetToken.deleteMany({});
    await prisma.refreshTokenSession.deleteMany({});
    await prisma.externalIdentity.deleteMany({});
    await prisma.user.deleteMany({});
  });

  it('1.6.6: Repeated verified Gmail login binds one Google subject to one user', async () => {
    googleIdentity = {
      subject: `google-${crypto.randomUUID()}`,
      email: `farmer-${crypto.randomUUID().slice(0, 8)}@gmail.com`,
      fullName: 'Nông dân Google',
      avatarUrl: null,
    };

    const first = await authService.loginWithGoogle({ credential: 'verified-token' });
    const second = await authService.loginWithGoogle({ credential: 'verified-token' });

    assert.equal(second.user.id, first.user.id);
    assert.equal(await prisma.user.count({ where: { email: googleIdentity.email } }), 1);
    assert.equal(
      await prisma.externalIdentity.count({
        where: { providerSubject: googleIdentity.subject },
      }),
      1,
    );
  });

  it('1.6.8: Google sign-in never auto-links an existing privileged account', async () => {
    googleIdentity = {
      subject: `google-${crypto.randomUUID()}`,
      email: `admin-${crypto.randomUUID().slice(0, 8)}@gmail.com`,
      fullName: 'Quản trị viên',
      avatarUrl: null,
    };
    await prisma.user.create({
      data: {
        email: googleIdentity.email,
        passwordHash: await authService.hashPassword('StrongPassword@2026'),
        fullName: googleIdentity.fullName,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    await assert.rejects(
      () => authService.loginWithGoogle({ credential: 'verified-token' }),
      (error) => error?.status === 403,
    );
    assert.equal(await prisma.externalIdentity.count(), 0);
  });

  it('1.6.7: Configuring Google automatically requires verified Google registration', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
    try {
      await assert.rejects(
        () =>
          authService.register({
            email: `blocked-${crypto.randomUUID()}@example.com`,
            phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
            password: 'StrongPassword@2026',
            fullName: 'Tài khoản chưa xác minh',
          }),
        (error) => error?.status === 403,
      );
    } finally {
      delete process.env.GOOGLE_CLIENT_ID;
    }
  });

  it('1.6.1: Register success & rejection of duplicate email and phone', async () => {
    const email = `farmer-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const phone = '090' + Math.floor(1000000 + Math.random() * 9000000);
    const password = 'StrongPassword@2026';
    const fullName = 'Nguyễn Nông Dân';

    // 1. Register new user
    const result = await authService.register({
      email,
      phone,
      password,
      fullName,
    });

    assert.ok(result.user, 'Result should include user');
    assert.equal(result.user.email, email.toLowerCase());
    assert.equal(result.user.phone, phone);
    assert.equal(result.user.fullName, fullName);
    assert.ok(result.accessToken, 'Access token should be issued');
    assert.ok(result.refreshToken, 'Refresh token should be issued');

    // Verify DB state: password must be hashed, never plaintext
    const dbUser = await prisma.user.findUnique({ where: { email } });
    assert.ok(dbUser, 'User must exist in DB');
    assert.notEqual(dbUser.passwordHash, password, 'Password must be hashed');
    assert.ok(dbUser.passwordHash.startsWith('$2'), 'Must be bcrypt hash');

    // 2. Reject duplicate email
    await assert.rejects(
      async () => {
        await authService.register({
          email,
          phone: '091' + Math.floor(1000000 + Math.random() * 9000000),
          password: 'AnotherPassword@123',
          fullName: 'Người Trùng Email',
        });
      },
      (err) => {
        assert.ok(err instanceof ConflictException);
        assert.match(err.message, /Email đã được sử dụng/);
        return true;
      },
      'Expected ConflictException for duplicate email',
    );

    // 3. Reject duplicate phone
    await assert.rejects(
      async () => {
        await authService.register({
          email: `different-${crypto.randomUUID().slice(0, 8)}@example.com`,
          phone,
          password: 'AnotherPassword@123',
          fullName: 'Người Trùng SĐT',
        });
      },
      (err) => {
        assert.ok(err instanceof ConflictException);
        assert.match(err.message, /Số điện thoại đã được đăng ký/);
        return true;
      },
      'Expected ConflictException for duplicate phone',
    );
  });

  it('1.6.2: Login success, wrong password, and non-existent email', async () => {
    const email = `login-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const password = 'CorrectPassword@123';
    const fullName = 'Trần Đại Lợi';

    await authService.register({
      email,
      password,
      fullName,
    });

    // 1. Login success
    const loginResult = await authService.login({
      email,
      password,
    });

    assert.ok(loginResult.accessToken, 'Login should return accessToken');
    assert.ok(loginResult.refreshToken, 'Login should return refreshToken');
    assert.equal(loginResult.user.email, email);

    // Verify lastLoginAt updated
    const userAfterLogin = await prisma.user.findUnique({ where: { email } });
    assert.ok(userAfterLogin.lastLoginAt, 'lastLoginAt should be updated');

    // 2. Login with wrong password
    await assert.rejects(
      async () => {
        await authService.login({
          email,
          password: 'WrongPassword@999',
        });
      },
      (err) => {
        assert.ok(err instanceof UnauthorizedException);
        assert.match(err.message, /Email hoặc mật khẩu không chính xác/);
        return true;
      },
      'Expected UnauthorizedException for wrong password',
    );

    // 3. Login with non-existent email
    await assert.rejects(
      async () => {
        await authService.login({
          email: 'nonexistent-user@example.com',
          password: 'SomePassword@123',
        });
      },
      (err) => {
        assert.ok(err instanceof UnauthorizedException);
        assert.match(err.message, /Email hoặc mật khẩu không chính xác/);
        return true;
      },
      'Expected UnauthorizedException for non-existent email',
    );
  });

  it('1.6.3: Refresh token rotation and revoked token reuse detection', async () => {
    const email = `refresh-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const regResult = await authService.register({
      email,
      password: 'SecurePassword@123',
      fullName: 'Lê Văn Xoay',
    });

    const originalRefreshToken = regResult.refreshToken;

    // 1. Refresh token rotation: exchange originalRefreshToken for new pair
    const refreshResult = await authService.refresh(originalRefreshToken);
    assert.ok(refreshResult.accessToken, 'Must return new accessToken');
    assert.ok(refreshResult.refreshToken, 'Must return new refreshToken');
    assert.notEqual(
      refreshResult.refreshToken,
      originalRefreshToken,
      'New refreshToken must differ',
    );

    // 2. Verify original session in DB is now REVOKED
    const originalHash = authService.hashToken(originalRefreshToken);
    const originalSession = await prisma.refreshTokenSession.findUnique({
      where: { tokenHash: originalHash },
    });
    assert.ok(originalSession, 'Original session record must exist');
    assert.ok(originalSession.revokedAt, 'Original session must be revoked');

    // 3. Verify new session in DB is ACTIVE (revokedAt is null)
    const newHash = authService.hashToken(refreshResult.refreshToken);
    const newSession = await prisma.refreshTokenSession.findUnique({
      where: { tokenHash: newHash },
    });
    assert.ok(newSession, 'New session record must exist');
    assert.equal(newSession.revokedAt, null, 'New session must not be revoked');

    // 4. Token Reuse Detection: Attempt to reuse the OLD revoked refreshToken -> Must be rejected
    await assert.rejects(
      async () => {
        await authService.refresh(originalRefreshToken);
      },
      (err) => {
        assert.ok(err instanceof UnauthorizedException);
        assert.match(err.message, /Phát hiện token đã bị thu hồi/);
        return true;
      },
      'Expected UnauthorizedException when reusing revoked refresh token',
    );

    // 5. Verify Token Family Batch Revocation (RFC 6819):
    // Toàn bộ các phiên đăng nhập còn lại (bao gồm newSession) phải bị thu hồi ngay lập tức
    const familySessionAfterReuse = await prisma.refreshTokenSession.findUnique({
      where: { tokenHash: newHash },
    });
    assert.ok(
      familySessionAfterReuse.revokedAt !== null,
      'Toàn bộ token trong cùng family phải bị thu hồi khi phát hiện token reuse',
    );
  });

  it('1.6.4: Logout and Logout All sessions', async () => {
    const email = `logout-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const regResult = await authService.register({
      email,
      password: 'LogoutPassword@123',
      fullName: 'Võ Minh Đăng',
    });

    const user = regResult.user;
    const session1RefreshToken = regResult.refreshToken;

    // Simulate login from second device
    const login2Result = await authService.login({
      email,
      password: 'LogoutPassword@123',
    });
    const session2RefreshToken = login2Result.refreshToken;

    // Check 2 active sessions in DB
    const activeBefore = await prisma.refreshTokenSession.count({
      where: { userId: user.id, revokedAt: null },
    });
    assert.equal(activeBefore, 2, 'User should have 2 active sessions');

    // 1. Logout single session (session 1)
    const logoutRes = await authService.logout(session1RefreshToken);
    assert.equal(logoutRes.message, 'Đăng xuất thành công');

    // Verify session 1 revoked, session 2 still active
    const s1 = await prisma.refreshTokenSession.findUnique({
      where: { tokenHash: authService.hashToken(session1RefreshToken) },
    });
    assert.ok(s1.revokedAt, 'Session 1 must be revoked');

    const s2 = await prisma.refreshTokenSession.findUnique({
      where: { tokenHash: authService.hashToken(session2RefreshToken) },
    });
    assert.equal(s2.revokedAt, null, 'Session 2 should still be active');

    // 2. Logout All (revokes remaining sessions)
    const logoutAllRes = await authService.logoutAll(user.id);
    assert.equal(logoutAllRes.message, 'Đã đăng xuất khỏi tất cả các thiết bị');

    const remainingActive = await prisma.refreshTokenSession.count({
      where: { userId: user.id, revokedAt: null },
    });
    assert.equal(remainingActive, 0, 'No active sessions should remain');
  });

  it('1.6.5: Password reset flow, token expiry, and used token rejection', async () => {
    const email = `reset-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const initialPassword = 'OldPassword@123';
    const newPassword = 'BrandNewPassword@2026';

    const regResult = await authService.register({
      email,
      password: initialPassword,
      fullName: 'Hoàng Khôi Phục',
    });
    const userId = regResult.user.id;

    // 1. Request password reset (forgotPassword)
    const forgotRes = await authService.forgotPassword({ email });
    assert.match(forgotRes.message, /hướng dẫn khôi phục sẽ được gửi/);

    // Verify DevEmailProvider captured the reset token
    const resetToken = devEmailProvider.lastSentToken;
    assert.ok(resetToken, 'Email provider should have captured the reset token');
    assert.equal(devEmailProvider.lastSentEmail, email);

    // Verify DB record: hash stored, expires in ~15 mins, usedAt is null
    const tokenHash = authService.hashToken(resetToken);
    const tokenRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    assert.ok(tokenRecord, 'Reset token record must exist in DB');
    assert.equal(tokenRecord.userId, userId);
    assert.equal(tokenRecord.usedAt, null);
    assert.ok(tokenRecord.expiresAt > new Date(), 'expiresAt must be in the future');

    // 2. Perform reset password successfully
    const resetRes = await authService.resetPassword({
      resetToken,
      newPassword,
    });
    assert.match(resetRes.message, /đặt lại thành công/);

    // Verify in DB: token marked used
    const tokenRecordAfter = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    assert.ok(tokenRecordAfter.usedAt, 'Token usedAt must be set');

    // Verify user can now login with NEW password
    const newLogin = await authService.login({ email, password: newPassword });
    assert.ok(newLogin.accessToken, 'Login with new password should succeed');

    // Verify user CANNOT login with OLD password
    await assert.rejects(
      async () => {
        await authService.login({ email, password: initialPassword });
      },
      (err) => {
        assert.ok(err instanceof UnauthorizedException);
        return true;
      },
    );

    // 3. Used token rejection: Attempt to use the same reset token again -> Must throw BadRequestException
    await assert.rejects(
      async () => {
        await authService.resetPassword({
          resetToken,
          newPassword: 'AnotherNewPassword@999',
        });
      },
      (err) => {
        assert.ok(err instanceof BadRequestException);
        assert.match(err.message, /đã được sử dụng/);
        return true;
      },
      'Expected BadRequestException for already-used reset token',
    );

    // 4. Expired token rejection: Insert an expired token in DB and attempt reset
    const expiredRawToken = crypto.randomBytes(32).toString('hex');
    const expiredHash = authService.hashToken(expiredRawToken);
    await prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: expiredHash,
        expiresAt: new Date(Date.now() - 60 * 1000), // expired 1 minute ago
      },
    });

    await assert.rejects(
      async () => {
        await authService.resetPassword({
          resetToken: expiredRawToken,
          newPassword: 'AnotherPassword@888',
        });
      },
      (err) => {
        assert.ok(err instanceof BadRequestException);
        assert.match(err.message, /đã hết hạn/);
        return true;
      },
      'Expected BadRequestException for expired reset token',
    );
  });
});
