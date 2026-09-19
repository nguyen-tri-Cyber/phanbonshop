'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  Boxes,
  Users,
  Package,
  FolderTree,
  Award,
  Store,
  LogOut,
  Shield,
  Sprout,
  Ticket,
  Newspaper,
  Image as ImageIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/auth-context';
import { UserRole } from '../../types/index';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout, hasRole } = useAuth();

  const navLinks: Array<{
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    roles: UserRole[];
  }> = [
    {
      label: 'Tổng Quan',
      href: '/admin',
      icon: LayoutDashboard,
      roles: ['STAFF', 'WAREHOUSE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    },
    {
      label: 'Đơn Hàng',
      href: '/admin/don-hang',
      icon: ClipboardList,
      roles: ['STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    },
    {
      label: 'Kho Hàng',
      href: '/admin/kho-hang',
      icon: Boxes,
      roles: ['STAFF', 'WAREHOUSE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    },
    {
      label: 'Khách Hàng',
      href: '/admin/khach-hang',
      icon: Users,
      roles: ['STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    },
    {
      label: 'Sản Phẩm',
      href: '/admin/san-pham',
      icon: Package,
      roles: ['STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    },
    {
      label: 'Danh Mục',
      href: '/admin/danh-muc',
      icon: FolderTree,
      roles: ['STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    },
    {
      label: 'Mã Giảm Giá',
      href: '/admin/ma-giam-gia',
      icon: Ticket,
      roles: ['STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    },
    {
      label: 'Thương Hiệu',
      href: '/admin/thuong-hieu',
      icon: Award,
      roles: ['STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    },
    {
      label: 'Bài Viết & Tin Tức',
      href: '/admin/bai-viet',
      icon: Newspaper,
      roles: ['STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    },
    {
      label: 'Banner & Giao Diện',
      href: '/admin/banner',
      icon: ImageIcon,
      roles: ['STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    },
  ];

  return (
    <aside className="w-64 bg-gray-900 text-gray-300 flex flex-col flex-shrink-0 min-h-screen border-r border-gray-800">
      {/* Brand logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-800 space-x-3 bg-gray-950">
        <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center text-white shadow">
          <Sprout className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-black text-white tracking-wider">
            PHÂN BÓN ADMIN
          </span>
          <span className="text-[10px] text-harvest-400 font-semibold uppercase">
            Hệ thống quản trị
          </span>
        </div>
      </div>

      {/* User profile brief */}
      <div className="p-4 mx-3 my-3 rounded-lg bg-gray-800/60 border border-gray-750 flex items-center space-x-3">
        <div className="h-9 w-9 rounded-full bg-primary-900 text-primary-300 border border-primary-600 flex items-center justify-center font-bold text-sm">
          {user?.fullName?.charAt(0).toUpperCase() || 'A'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">
            {user?.fullName || 'Quản trị viên'}
          </p>
          <div className="flex items-center space-x-1 mt-0.5">
            <Shield className="h-3 w-3 text-harvest-400" />
            <Badge variant="warning" className="text-[9px] px-1.5 py-0 h-4">
              {user?.role || 'ADMIN'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        <div className="px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          Phân Hệ Quản Trị
        </div>

        {navLinks.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (!hasRole(item.roles)) {
            return null;
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors',
                isActive
                  ? 'bg-primary-600 text-white font-semibold shadow-sm'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer controls */}
      <div className="p-3 border-t border-gray-800 space-y-1 bg-gray-950/60">
        <Link
          href="/"
          className="flex items-center space-x-3 px-3 py-2 rounded-lg text-xs text-primary-400 hover:bg-gray-800 hover:text-primary-300 transition-colors"
        >
          <Store className="h-4 w-4" />
          <span>Về Cửa Hàng Bán Lẻ</span>
        </Link>
        <button
          onClick={() => logout()}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors text-left"
        >
          <LogOut className="h-4 w-4" />
          <span>Đăng Xuất</span>
        </button>
      </div>
    </aside>
  );
}
