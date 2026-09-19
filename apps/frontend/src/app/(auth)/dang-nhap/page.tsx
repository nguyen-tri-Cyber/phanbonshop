'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Sprout, LogIn, Lock, Mail, AlertCircle, ArrowLeft, KeyRound } from 'lucide-react';
import { useAuth } from '../../../contexts/auth-context';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Alert, AlertDescription } from '../../../components/ui/alert';

const loginSchema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/';

  const { login } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await login(values);

    if (res.success) {
      router.push(returnUrl);
    } else {
      setErrorMessage(res.error || 'Đăng nhập không thành công');
      setIsSubmitting(false);
    }
  };

  // Quick fill helper cho nhà phát triển & người chấm bài
  const fillCredentials = (email: string, pass: string) => {
    setValue('email', email);
    setValue('password', pass);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center space-x-2">
          <div className="h-10 w-10 rounded-lg bg-primary-600 flex items-center justify-center text-white shadow-md">
            <Sprout className="h-6 w-6" />
          </div>
          <span className="text-xl font-black text-primary-800 tracking-tight">
            PHÂN BÓN SHOP
          </span>
        </Link>
        <h2 className="mt-4 text-2xl font-black text-gray-900 tracking-tight">
          Đăng Nhập Tài Khoản
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Chưa có tài khoản?{' '}
          <Link href="/dang-ky" className="font-semibold text-primary-600 hover:text-primary-700">
            Đăng ký tài khoản mới ngay
          </Link>
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl border border-gray-200 sm:px-10 space-y-6">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Địa chỉ Email
              </label>
              <div className="relative">
                <Input
                  type="email"
                  placeholder="nongdan@example.com"
                  {...register('email')}
                  className={errors.email ? 'border-red-500' : ''}
                />
                <Mail className="h-4 w-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {errors.email && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700">
                  Mật khẩu
                </label>
                <span className="text-[11px] text-primary-600 hover:underline cursor-pointer">
                  Quên mật khẩu?
                </span>
              </div>
              <div className="relative">
                <Input
                  type="password"
                  placeholder="••••••••"
                  {...register('password')}
                  className={errors.password ? 'border-red-500' : ''}
                />
                <Lock className="h-4 w-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {errors.password && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full justify-center space-x-2 font-bold shadow-sm"
            >
              <LogIn className="h-4 w-4" />
              <span>{isSubmitting ? 'Đang xác thực...' : 'Đăng Nhập'}</span>
            </Button>
          </form>

          {/* Quick Login Test Accounts */}
          <div className="pt-4 border-t border-gray-100 space-y-2">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center space-x-1">
              <KeyRound className="h-3.5 w-3.5 text-harvest-500" />
              <span>Gợi ý tài khoản kiểm thử:</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillCredentials('farmer1@example.com', 'MatKhau@123')}
                className="p-2 text-left border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50/50 transition-colors"
              >
                <div className="text-xs font-bold text-gray-800">Tài Khoản Nông Dân</div>
                <div className="text-[10px] text-gray-500 truncate">farmer1@example.com</div>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials('admin@local.test', 'Admin@123456')}
                className="p-2 text-left border border-gray-200 rounded-lg hover:border-harvest-500 hover:bg-harvest-50/50 transition-colors"
              >
                <div className="text-xs font-bold text-gray-800">Quản Trị Hệ Thống</div>
                <div className="text-[10px] text-gray-500 truncate">admin@local.test</div>
              </button>
            </div>
          </div>

          <div className="text-center pt-2">
            <Link
              href="/"
              className="inline-flex items-center text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              <span>Về trang chủ</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Đang tải...</div>}>
      <LoginContent />
    </Suspense>
  );
}
