import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL =
  (process.env.INTERNAL_GATEWAY_URL
    ? `${process.env.INTERNAL_GATEWAY_URL}/api/v1`
    : null) ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8080/api/v1';

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get('phanbon_refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_REFRESH_TOKEN',
            message: 'Không có phiên đăng nhập hợp lệ',
          },
        },
        { status: 401 },
      );
    }

    const response = await fetch(`${GATEWAY_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const res = NextResponse.json(data, { status: response.status });
      res.cookies.delete('phanbon_refresh_token');
      return res;
    }

    const { accessToken, refreshToken: newRefreshToken, user } = data.data;

    const res = NextResponse.json({
      success: true,
      data: {
        accessToken,
        user,
      },
    });

    if (newRefreshToken) {
      res.cookies.set('phanbon_refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
    }

    return res;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'REFRESH_ERROR',
          message: error instanceof Error ? error.message : 'Lỗi khi làm mới phiên',
        },
      },
      { status: 500 },
    );
  }
}
