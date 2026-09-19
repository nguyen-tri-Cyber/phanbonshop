'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Sprout, UserPlus, Lock, Mail, Phone, User, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../../contexts/auth-context';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Alert, AlertDescription } from '../../../components/ui/alert';

const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Họ và tên tối thiểu 2 ký tự'),
    email: z.string().min(1, 'Vui lòng nhập email').email('Email không đúng định dạng'),
    phone: z
      .string()
      .min(10, 'Số điện thoại phải từ 10 chữ số')
      .regex(/^(03|05|07|08|09)\d{8}$/, 'Số điện thoại không hợp lệ (định dạng Việt Nam)'),
    password: z
      .string()
      .min(8, 'Mật khẩu phải từ 8 ký tự')
      .regex(/[A-Z]/, 'Mật khẩu phải chứa ít nhất 1 chữ hoa')
      .regex(/[0-9]/, 'Mật khẩu phải chứa ít nhất 1 chữ số'),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await registerUser({
      fullName: values.fullName,
      email: values.email,
      phone: values.phone,
      password: values.password,
    });

    if (res.success) {
      setSuccessMessage('Đăng ký tài khoản thành công! Đang chuyển đến trang đăng nhập...');
      setTimeout(() => {
        router.push('/dang-nhap');
      }, 1500);
    } else {
      setErrorMessage(res.error || 'Đăng ký không thành công');
      setIsSubmitting(false);
    }
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
          Đăng Ký Tài Khoản Mới
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Đã có tài khoản?{' '}
          <Link href="/dang-nhap" className="font-semibold text-primary-600 hover:text-primary-700">
            Đăng nhập ngay
          </Link>
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl border border-gray-200 sm:px-10 space-y-5">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert variant="success">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
            {/* Họ và tên */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Họ và tên
              </label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Nguyễn Văn Nông Dân"
                  {...register('fullName')}
                  className={errors.fullName ? 'border-red-500' : ''}
                />
                <User className="h-4 w-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {errors.fullName && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Địa chỉ Email
              </label>
              <div className="relative">
                <Input
                  type="email"
                  placeholder="nongdan@gmail.com"
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

            {/* Số điện thoại */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Số điện thoại liên hệ
              </label>
              <div className="relative">
                <Input
                  type="tel"
                  placeholder="0912345678"
                  {...register('phone')}
                  className={errors.phone ? 'border-red-500' : ''}
                />
                <Phone className="h-4 w-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {errors.phone && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">
                  {errors.phone.message}
                </p>
              )}
            </div>

            {/* Mật khẩu */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Mật khẩu
              </label>
              <div className="relative">
                <Input
                  type="password"
                  placeholder="Tối thiểu 8 ký tự, 1 hoa, 1 số"
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

            {/* Xác nhận mật khẩu */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Xác nhận lại mật khẩu
              </label>
              <div className="relative">
                <Input
                  type="password"
                  placeholder="••••••••"
                  {...register('confirmPassword')}
                  className={errors.confirmPassword ? 'border-red-500' : ''}
                />
                <Lock className="h-4 w-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full justify-center space-x-2 font-bold shadow-sm mt-2"
            >
              <UserPlus className="h-4 w-4" />
              <span>{isSubmitting ? 'Đang khởi tạo tài khoản...' : 'Đăng Ký Tài Khoản'}</span>
            </Button>
          </form>

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
