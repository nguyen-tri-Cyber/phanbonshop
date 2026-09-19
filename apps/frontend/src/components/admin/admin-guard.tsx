'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, LogIn, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/auth-context';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen p-8 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  // Chưa đăng nhập
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center space-y-4">
          <div className="h-16 w-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            Yêu Cầu Đăng Nhập Quản Trị
          </h2>
          <p className="text-sm text-gray-600">
            Bạn cần đăng nhập bằng tài khoản có quyền Quản trị, Thủ kho hoặc Nhân viên để truy cập phân hệ này.
          </p>
          <div className="pt-2 space-y-2">
            <Link href="/dang-nhap?returnUrl=/admin" className="block w-full">
              <Button className="w-full justify-center space-x-2">
                <LogIn className="h-4 w-4" />
                <span>Đăng nhập ngay</span>
              </Button>
            </Link>
            <Link href="/" className="block w-full">
              <Button variant="outline" className="w-full justify-center space-x-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Về trang chủ</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Đã đăng nhập nhưng là CUSTOMER (Không có quyền)
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-red-200 p-8 text-center space-y-4">
          <div className="h-16 w-16 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-red-900">
            403 - Không Có Quyền Truy Cập
          </h2>
          <div className="text-sm text-gray-600 space-y-1">
            <p>
              Tài khoản <strong>{user.email}</strong> có vai trò:{' '}
              <span className="font-bold text-primary-700">[{user.role}]</span>.
            </p>
            <p className="text-xs text-gray-500">
              Chỉ các vai trò WAREHOUSE, STAFF, MANAGER, ADMIN mới có quyền truy cập trang quản trị hệ thống.
            </p>
          </div>
          <div className="pt-4">
            <Link href="/" className="block w-full">
              <Button className="w-full justify-center space-x-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Quay về Cửa Hàng Bán Lẻ</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
