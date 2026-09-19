import React from 'react';
import Link from 'next/link';
import { Sprout, Phone, Mail, MapPin, ShieldCheck, Truck, RefreshCw } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 pt-12 pb-8 border-t-4 border-primary-600">
      {/* 3 cam kết vàng */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 border-b border-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex items-start space-x-4">
            <div className="h-12 w-12 rounded-xl bg-primary-900/60 text-primary-400 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">100% Chính Hãng</h4>
              <p className="text-xs text-gray-400 mt-1">
                Phân phối trực tiếp từ nhà máy Bình Điền, Đạm Phú Mỹ, PVCFC. Có đầy đủ hóa đơn chứng từ.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="h-12 w-12 rounded-xl bg-harvest-900/60 text-harvest-400 flex items-center justify-center flex-shrink-0">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">Giao Hàng Tận Vườn</h4>
              <p className="text-xs text-gray-400 mt-1">
                Đội xe tải hỗ trợ bốc xếp tận chân ruộng, kho đại lý tại ĐBSCL, Miền Đông và Tây Nguyên.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="h-12 w-12 rounded-xl bg-blue-900/60 text-blue-400 flex items-center justify-center flex-shrink-0">
              <RefreshCw className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">Đổi Trả & Bồi Thường</h4>
              <p className="text-xs text-gray-400 mt-1">
                Đền bù 200% nếu phát hiện phân bón giả, kém chất lượng hoặc sai hàm lượng công bố.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main footer links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Cột 1: Thông tin công ty */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center text-white">
              <Sprout className="h-5 w-5" />
            </div>
            <span className="text-lg font-black text-white tracking-tight">
              PHÂN BÓN SHOP
            </span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Hệ thống sàn thương mại điện tử vật tư phân bón hàng đầu Việt Nam. Cung ứng giải pháp dinh dưỡng cây trồng toàn diện và năng suất cao.
          </p>
          <div className="pt-2 text-xs space-y-1.5 text-gray-400">
            <div className="flex items-center space-x-2">
              <Phone className="h-3.5 w-3.5 text-harvest-400" />
              <span>Hotline: 1800 6868 (Miễn phí)</span>
            </div>
            <div className="flex items-center space-x-2">
              <Mail className="h-3.5 w-3.5 text-harvest-400" />
              <span>hotro@phanbonshop.vn</span>
            </div>
          </div>
        </div>

        {/* Cột 2: Danh mục phân bón */}
        <div>
          <h4 className="text-white font-bold text-sm mb-3">Danh Mục Phân Bón</h4>
          <ul className="space-y-2 text-xs text-gray-400">
            <li>
              <Link href="/san-pham?category=phan-bon-npk-hon-hop" className="hover:text-white transition-colors">
                Phân bón NPK Đa Lượng
              </Link>
            </li>
            <li>
              <Link href="/san-pham?category=phan-bon-huu-co-vi-sinh" className="hover:text-white transition-colors">
                Phân bón Hữu cơ Vi sinh
              </Link>
            </li>
            <li>
              <Link href="/san-pham?category=phan-bon-la-kich-thich-sinh-truong" className="hover:text-white transition-colors">
                Phân bón Lá & Kích thích sinh trưởng
              </Link>
            </li>
            <li>
              <Link href="/san-pham?category=phan-bon-trung-vi-luong" className="hover:text-white transition-colors">
                Trung Vi lượng & Cải tạo đất
              </Link>
            </li>
            <li>
              <Link href="/san-pham?category=phan-bon-don-khoang-chat" className="hover:text-white transition-colors">
                Phân đơn (Urea, DAP, Kali)
              </Link>
            </li>
          </ul>
        </div>

        {/* Cột 3: Hướng dẫn & Chính sách */}
        <div>
          <h4 className="text-white font-bold text-sm mb-3">Hỗ Trợ Khách Hàng</h4>
          <ul className="space-y-2 text-xs text-gray-400">
            <li>
              <Link href="/tai-khoan" className="hover:text-white transition-colors">
                Tra cứu tài khoản & đơn hàng
              </Link>
            </li>
            <li>
              <span className="hover:text-white transition-colors cursor-pointer">
                Chính sách giao nhận hàng hóa
              </span>
            </li>
            <li>
              <span className="hover:text-white transition-colors cursor-pointer">
                Quy định bảo hành và đổi trả
              </span>
            </li>
            <li>
              <span className="hover:text-white transition-colors cursor-pointer">
                Hướng dẫn bón phân mùa vụ
              </span>
            </li>
            <li>
              <span className="hover:text-white transition-colors cursor-pointer">
                Chính sách cho Đại lý cấp 1 & cấp 2
              </span>
            </li>
          </ul>
        </div>

        {/* Cột 4: Hệ thống kho bãi */}
        <div>
          <h4 className="text-white font-bold text-sm mb-3">Kho Hàng Trung Chuyển</h4>
          <div className="space-y-2 text-xs text-gray-400">
            <div className="flex items-start space-x-2">
              <MapPin className="h-4 w-4 text-primary-400 flex-shrink-0 mt-0.5" />
              <span><strong>Kho Miền Tây:</strong> KCN Tân Hương, Châu Thành, Tiền Giang</span>
            </div>
            <div className="flex items-start space-x-2">
              <MapPin className="h-4 w-4 text-primary-400 flex-shrink-0 mt-0.5" />
              <span><strong>Kho Tây Nguyên:</strong> KCN Hòa Phú, TP. Buôn Ma Thuột, Đắk Lắk</span>
            </div>
            <div className="flex items-start space-x-2">
              <MapPin className="h-4 w-4 text-primary-400 flex-shrink-0 mt-0.5" />
              <span><strong>Kho Đông Nam Bộ:</strong> KCN Nhơn Trạch, Đồng Nai</span>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 mt-4 border-t border-gray-800 text-center text-xs text-gray-500">
        <p>© 2026 Phân Bón Shop (fertilizer-commerce). Nền tảng TMĐT Nông nghiệp Việt Nam.</p>
      </div>
    </footer>
  );
}
