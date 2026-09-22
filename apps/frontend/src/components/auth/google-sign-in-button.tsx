'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/auth-context';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsApi {
  id: {
    initialize(options: {
      client_id: string;
      callback: (response: GoogleCredentialResponse) => void;
      auto_select: boolean;
      cancel_on_tap_outside: boolean;
    }): void;
    renderButton(
      parent: HTMLElement,
      options: {
        type: 'standard';
        theme: 'outline';
        size: 'large';
        text: 'signin_with' | 'signup_with';
        shape: 'rectangular';
        width: number;
        locale: 'vi';
      },
    ): void;
  };
}

declare global {
  interface Window {
    google?: { accounts: GoogleAccountsApi };
  }
}

interface GoogleSignInButtonProps {
  mode?: 'signin' | 'signup';
  onAuthenticated: () => void;
}

export function GoogleSignInButton({ mode = 'signin', onAuthenticated }: GoogleSignInButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  const containerRef = useRef<HTMLDivElement>(null);
  const { loginWithGoogle } = useAuth();
  const [isScriptReady, setIsScriptReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(() => {
    if (!clientId || !isScriptReady || !window.google || !containerRef.current) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: async ({ credential }) => {
        if (!credential) {
          setError('Google không cung cấp thông tin xác thực. Vui lòng thử lại.');
          return;
        }
        setError(null);
        const result = await loginWithGoogle(credential);
        if (result.success) onAuthenticated();
        else setError(result.error || 'Đăng nhập Google không thành công');
      },
    });
    containerRef.current.replaceChildren();
    window.google.accounts.id.renderButton(containerRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: mode === 'signup' ? 'signup_with' : 'signin_with',
      shape: 'rectangular',
      width: 320,
      locale: 'vi',
    });
  }, [clientId, isScriptReady, loginWithGoogle, mode, onAuthenticated]);

  useEffect(() => initialize(), [initialize]);

  if (!clientId) return null;

  return (
    <div className="space-y-2" aria-live="polite">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setIsScriptReady(true)}
        onError={() => setError('Không thể tải dịch vụ đăng nhập Google')}
      />
      <div ref={containerRef} className="flex min-h-10 justify-center" />
      {error && (
        <p className="flex items-center justify-center gap-1 text-xs font-medium text-red-600">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
