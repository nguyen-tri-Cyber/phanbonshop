import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';

interface GoogleLoginTicket {
  getPayload(): TokenPayload | undefined;
}

interface GoogleTokenClient {
  verifyIdToken(options: { idToken: string; audience: string }): Promise<GoogleLoginTicket>;
}

export interface VerifiedGoogleIdentity {
  subject: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
}

@Injectable()
export class GoogleIdentityVerifier {
  private readonly clientId: string;
  private readonly client: GoogleTokenClient;

  constructor(
    clientId = process.env.GOOGLE_CLIENT_ID?.trim() || '',
    client: GoogleTokenClient = new OAuth2Client(),
  ) {
    this.clientId = clientId;
    this.client = client;
  }

  get isConfigured(): boolean {
    return this.clientId.length > 0;
  }

  async verify(credential: string): Promise<VerifiedGoogleIdentity> {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException('Đăng nhập Google chưa được cấu hình');
    }

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: credential,
        audience: this.clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Thông tin xác thực Google không hợp lệ hoặc đã hết hạn');
    }

    const subject = payload?.sub?.trim();
    const email = payload?.email?.trim().toLowerCase();
    if (!subject || !email || payload?.email_verified !== true) {
      throw new UnauthorizedException('Tài khoản Google chưa xác minh email');
    }
    if (!email.endsWith('@gmail.com')) {
      throw new UnauthorizedException('Hiện tại hệ thống chỉ hỗ trợ tài khoản Gmail đã xác minh');
    }

    const fullName = (payload.name?.trim() || email.split('@')[0] || 'Khách hàng Google').slice(
      0,
      100,
    );

    return {
      subject,
      email,
      fullName,
      avatarUrl: this.normalizeAvatarUrl(payload.picture),
    };
  }

  private normalizeAvatarUrl(value?: string): string | null {
    if (!value) return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'lh3.googleusercontent.com'
        ? url.toString().slice(0, 500)
        : null;
    } catch {
      return null;
    }
  }
}
