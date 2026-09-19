import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const response = await fetch(`${GATEWAY_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return NextResponse.json(data, { status: response.status });
    }

    const { user, accessToken, refreshToken } = data.data;

    const res = NextResponse.json({
      success: true,
      data: {
        user,
        accessToken,
      },
    });

    // Lưu refresh token vào HttpOnly Cookie bảo mật cao
    if (refreshToken) {
      res.cookies.set('phanbon_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 ngày
      });
    }

    return res;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'AUTH_GATEWAY_ERROR',
          message: error instanceof Error ? error.message : 'Lỗi kết nối tới Gateway',
        },
      },
      { status: 500 },
    );
  }
}
