import { ApiResponse } from '../types/index';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

// In-memory token storage (chỉ tồn tại trong bộ nhớ runtime của tab)
let currentAccessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  currentAccessToken = token;
}

export function getAccessToken(): string | null {
  return currentAccessToken;
}

interface RequestOptions extends RequestInit {
  requireAuth?: boolean;
}

/**
 * API client duy nhất của frontend, chỉ gọi API Gateway http://localhost:8080/api/v1
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const { requireAuth = false, headers = {}, ...rest } = options;

  // Đảm bảo endpoint bắt đầu bằng dấu /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (currentAccessToken) {
    requestHeaders['Authorization'] = `Bearer ${currentAccessToken}`;
  } else if (requireAuth) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Bạn cần đăng nhập để thực hiện thao tác này',
      },
    };
  }

  try {
    let response = await fetch(url, {
      ...rest,
      headers: requestHeaders,
    });

    // Nếu nhận 401 Unauthorized và có token, thử refresh token 1 lần
    if (response.status === 401 && currentAccessToken) {
      try {
        const refreshRes = await fetch('/api/auth/refresh', { method: 'POST' });
        const refreshData = await refreshRes.json();

        if (refreshData.success && refreshData.data?.accessToken) {
          setAccessToken(refreshData.data.accessToken);
          requestHeaders['Authorization'] = `Bearer ${refreshData.data.accessToken}`;

          // Retry lại request ban đầu
          response = await fetch(url, {
            ...rest,
            headers: requestHeaders,
          });
        } else {
          setAccessToken(null);
        }
      } catch {
        setAccessToken(null);
      }
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        error: {
          code: data?.error?.code || `HTTP_${response.status}`,
          message:
            data?.error?.message ||
            `Lỗi máy chủ (${response.status}): ${response.statusText}`,
        },
        requestId: data?.requestId,
      };
    }

    return data as ApiResponse<T>;
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message:
          err instanceof Error
            ? err.message
            : 'Không thể kết nối đến hệ thống máy chủ API Gateway',
      },
    };
  }
}
