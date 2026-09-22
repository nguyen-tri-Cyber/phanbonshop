import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL =
  (process.env.INTERNAL_GATEWAY_URL ? `${process.env.INTERNAL_GATEWAY_URL}/api/v1` : null) ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8080/api/v1';

export async function POST(req: NextRequest) {
  if (req.headers.get('x-google-identity') !== '1') {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Yêu cầu đăng nhập Google không hợp lệ' },
      },
      { status: 403 },
    );
  }

  try {
    const body = await req.json();
    const response = await fetch(`${GATEWAY_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      return NextResponse.json(data, { status: response.status });
    }

    const { user, accessToken, refreshToken } = data.data;
    const res = NextResponse.json({ success: true, data: { user, accessToken } });
    if (refreshToken) {
      res.cookies.set('phanbon_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
    }
    return res;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'AUTH_GATEWAY_ERROR', message: 'Không thể xác thực với Google' },
      },
      { status: 500 },
    );
  }
}
