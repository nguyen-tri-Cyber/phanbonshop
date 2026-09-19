'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { useAuth } from '../../contexts/auth-context';
import { Badge } from '../ui/badge';

export function AdminHeader() {
  const pathname = usePathname();
  const { user } = useAuth();

  const getBreadcrumbTitle = (path: string) => {
    switch (path) {
      case '/admin':
        return 'Tổng Quan';
      case '/admin/ton-kho':
        return 'Quản Lý Tồn Kho';
      case '/admin/san-pham':
        return 'Quản Lý Sản Phẩm';
      default:
        return 'Quản Trị';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shadow-sm">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-xs text-gray-500 font-medium">
        <Link href="/admin" className="flex items-center hover:text-gray-900 transition-colors">
          <Home className="h-3.5 w-3.5 mr-1 text-gray-400" />
          <span>Admin</span>
        </Link>
        {pathname !== '/admin' && (
          <>
            <ChevronRight className="h-3 w-3 text-gray-400" />
            <span className="text-gray-900 font-semibold">
              {getBreadcrumbTitle(pathname)}
            </span>
          </>
        )}
      </nav>

      {/* Right controls */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center font-bold text-xs">
            {user?.fullName?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-semibold text-gray-900 leading-tight">
              {user?.fullName}
            </span>
            <span className="text-[10px] text-gray-500">
              {user?.email}
            </span>
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex text-[10px]">
            {user?.role}
          </Badge>
        </div>
      </div>
    </header>
  );
}
