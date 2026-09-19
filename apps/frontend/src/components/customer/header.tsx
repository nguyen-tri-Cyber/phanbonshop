'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sprout,
  Search,
  ShoppingCart,
  User as UserIcon,
  LogOut,
  LayoutDashboard,
  Menu,
  X,
  PhoneCall,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { useAuth } from '../../contexts/auth-context';
import { useCart } from '../../contexts/cart-context';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export function Header() {
  const router = useRouter();
  const { user, logout, isAdmin } = useAuth();
  const { totalItems, setIsOpen: openCart } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/tim-kiem?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    setIsUserMenuOpen(false);
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white shadow-sm">
      {/* Top Banner Tiện ích nông nghiệp */}
      <div className="bg-primary-900 text-xs text-white py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-6">
            <span className="flex items-center space-x-1.5">
              <PhoneCall className="h-3.5 w-3.5 text-harvest-400" />
              <span>Tư vấn kỹ thuật cây trồng: <strong className="text-harvest-300">1800 6868</strong> (Miễn phí)</span>
            </span>
            <span className="hidden md:flex items-center space-x-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-harvest-400" />
              <span>100% Phân bón chính hãng có kiểm định</span>
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="hidden sm:flex items-center space-x-1.5">
              <Truck className="h-3.5 w-3.5 text-harvest-400" />
              <span>Giao hàng tận nơi toàn quốc</span>
            </span>
            {isAdmin && (
              <Link
                href="/admin"
                className="bg-harvest-500 hover:bg-harvest-600 text-white px-2 py-0.5 rounded text-xs font-semibold flex items-center space-x-1 transition-colors"
              >
                <LayoutDashboard className="h-3 w-3" />
                <span>Trang Quản Trị</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Mobile menu trigger */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="lg:hidden p-2 text-gray-600 hover:text-primary-700"
          aria-label="Toggle navigation"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-2.5 flex-shrink-0">
          <div className="h-10 w-10 rounded-lg bg-primary-600 flex items-center justify-center text-white shadow-md">
            <Sprout className="h-6 w-6 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black text-primary-800 tracking-tight leading-none">
              PHÂN BÓN SHOP
            </span>
            <span className="text-[11px] font-medium text-gray-500 tracking-wider uppercase">
              Vật tư nông nghiệp Việt Nam
            </span>
          </div>
        </Link>

        {/* Search Entry */}
        <form
          onSubmit={handleSearch}
          className="hidden md:flex flex-1 max-w-xl mx-4 relative"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm phân bón NPK, Hữu cơ, Đạm Phú Mỹ, Đầu Trâu..."
            className="w-full pl-4 pr-11 py-2 text-sm border-2 border-primary-600/30 rounded-full focus:outline-none focus:border-primary-600 transition-colors bg-gray-50/50 focus:bg-white"
          />
          <button
            type="submit"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 bg-primary-600 hover:bg-primary-700 text-white rounded-full flex items-center justify-center transition-colors"
            aria-label="Tìm kiếm"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>

        {/* Action Controls: Account & Cart */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Account Dropdown */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-left"
              >
                <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center font-bold text-sm">
                  {user.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className="text-xs font-semibold text-gray-900 leading-tight max-w-[120px] truncate">
                    {user.fullName}
                  </span>
                  <span className="text-[10px] text-gray-500 font-medium">
                    {user.role === 'CUSTOMER' ? 'Khách hàng' : user.role}
                  </span>
                </div>
              </button>

              {/* User Menu Modal / Dropdown */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-900">{user.fullName}</p>
                    <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {user.role}
                    </Badge>
                  </div>
                  <Link
                    href="/tai-khoan"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <UserIcon className="h-4 w-4 text-gray-500" />
                    <span>Tài khoản của tôi</span>
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center space-x-2 px-4 py-2 text-sm text-primary-700 font-medium hover:bg-primary-50 transition-colors"
                    >
                      <LayoutDashboard className="h-4 w-4 text-primary-600" />
                      <span>Trang quản trị</span>
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link href="/dang-nhap">
                <Button variant="outline" size="sm" className="text-xs">
                  Đăng nhập
                </Button>
              </Link>
              <Link href="/dang-ky" className="hidden sm:inline-flex">
                <Button size="sm" className="text-xs">
                  Đăng ký
                </Button>
              </Link>
            </div>
          )}

          {/* Cart Icon */}
          <button
            onClick={() => openCart(true)}
            className="relative p-2 text-gray-700 hover:text-primary-700 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Giỏ hàng"
          >
            <ShoppingCart className="h-6 w-6" />
            {totalItems > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-harvest-500 text-white font-bold text-[10px] h-5 w-5 rounded-full flex items-center justify-center shadow">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="md:hidden px-4 pb-3">
        <form onSubmit={handleSearch} className="relative w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm phân bón NPK, Đạm, Hữu cơ..."
            className="w-full pl-3 pr-10 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-primary-600"
          />
          <button
            type="submit"
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-gray-500"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* Responsive Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white px-4 pt-2 pb-4 space-y-2">
          <Link
            href="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-gray-700 hover:text-primary-600 border-b border-gray-100"
          >
            Trang Chủ
          </Link>
          <Link
            href="/san-pham"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-gray-700 hover:text-primary-600 border-b border-gray-100"
          >
            Tất Cả Sản Phẩm
          </Link>
          <Link
            href="/danh-muc/phan-bon-npk-hon-hop"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-gray-700 hover:text-primary-600 border-b border-gray-100"
          >
            Phân Bón NPK & Hỗn Hợp
          </Link>
          <Link
            href="/danh-muc/phan-bon-huu-co-vi-sinh"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-gray-700 hover:text-primary-600 border-b border-gray-100"
          >
            Phân Bón Hữu Cơ Vi Sinh
          </Link>
          <Link
            href="/danh-muc/phan-bon-la-kich-thich-sinh-truong"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-gray-700 hover:text-primary-600 border-b border-gray-100"
          >
            Phân Bón Lá & Kích Thích
          </Link>
          <Link
            href="/thuong-hieu/binh-dien-dau-trau"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-gray-700 hover:text-primary-600 border-b border-gray-100"
          >
            Thương Hiệu Đầu Trâu
          </Link>
          <Link
            href="/tai-khoan"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-gray-700 hover:text-primary-600"
          >
            Tài Khoản Của Tôi
          </Link>
        </div>
      )}
    </header>
  );
}
