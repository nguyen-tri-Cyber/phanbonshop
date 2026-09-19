'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Leaf, Award, Percent, BookOpen } from 'lucide-react';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { label: 'Trang Chủ', href: '/' },
  { label: 'Tất Cả Sản Phẩm', href: '/san-pham', icon: Leaf },
  {
    label: 'NPK & Hỗn Hợp',
    href: '/danh-muc/phan-bon-npk-hon-hop',
  },
  {
    label: 'Hữu Cơ Vi Sinh',
    href: '/danh-muc/phan-bon-huu-co-vi-sinh',
  },
  {
    label: 'Phân Bón Lá',
    href: '/danh-muc/phan-bon-la-kich-thich-sinh-truong',
  },
  {
    label: 'Trung Vi Lượng',
    href: '/danh-muc/phan-bon-trung-vi-luong',
  },
  {
    label: 'Đầu Trâu',
    href: '/thuong-hieu/binh-dien-dau-trau',
    icon: Award,
  },
  {
    label: 'Kiến Thức Nông Nghiệp',
    href: '/kien-thuc',
    icon: BookOpen,
  },
  {
    label: 'Khuyến Mãi Vụ Mùa',
    href: '/san-pham?featured=true',
    icon: Percent,
    highlight: true,
  },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="hidden lg:block bg-primary-800 text-white shadow-inner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-1 py-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center space-x-1.5 px-3 py-2 rounded-md text-xs font-semibold tracking-wide transition-colors',
                  isActive
                    ? 'bg-primary-900 text-white'
                    : 'text-primary-100 hover:bg-primary-700 hover:text-white',
                  item.highlight && 'text-harvest-300 hover:text-harvest-200',
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
