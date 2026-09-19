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

    if (refreshToken) {
      await fetch(`${GATEWAY_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {
        // Ignored if gateway unavailable
      });
    }

    const res = NextResponse.json({
      success: true,
      data: { message: 'Đăng xuất thành công' },
    });

    res.cookies.delete('phanbon_refresh_token');
    return res;
  } catch (error) {
    const res = NextResponse.json(
      {
        success: false,
        error: {
          code: 'LOGOUT_ERROR',
          message: error instanceof Error ? error.message : 'Lỗi khi đăng xuất',
        },
      },
      { status: 500 },
    );
    res.cookies.delete('phanbon_refresh_token');
    return res;
  }
}
