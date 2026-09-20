'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '../../contexts/cart-context';
import { formatCurrencyVND } from '../../lib/formatters';
import { Button } from '../ui/button';

export function CartDrawer() {
  const router = useRouter();
  const {
    items,
    isOpen,
    setIsOpen,
    updateQuantity,
    removeItem,
    clearCart,
    totalPrice,
    totalItems,
  } = useCart();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity animate-in fade-in duration-200"
        onClick={() => setIsOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Drawer Header */}
          <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="flex items-center space-x-2">
              <ShoppingBag className="h-5 w-5 text-primary-700" />
              <h2 className="text-base font-bold text-gray-900">
                Giỏ Hàng ({totalItems} sản phẩm)
              </h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {items.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center space-y-3">
                <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                  <ShoppingBag className="h-8 w-8" />
                </div>
                <h3 className="text-base font-medium text-gray-900">
                  Giỏ hàng chưa có sản phẩm
                </h3>
                <p className="text-xs text-gray-500 max-w-xs">
                  Hãy khám phá các loại phân bón NPK, hữu cơ vi sinh chất lượng cao cho mùa vụ của bạn.
                </p>
                <Button
                  onClick={() => setIsOpen(false)}
                  className="mt-2 text-xs"
                >
                  Mua sắm ngay
                </Button>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.variantId}
                  className="flex space-x-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors bg-white"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900 truncate">
                      {item.productName}
                    </h4>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="text-xs text-gray-500 font-medium">
                        Quy cách: {item.packageSize}
                      </span>
                      <span className="text-xs text-gray-400">|</span>
                      <span className="text-xs font-semibold text-primary-700">
                        {formatCurrencyVND(item.price)}
                      </span>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-gray-300 rounded-md">
                        <button
                          onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                          className="p-1 hover:bg-gray-100 text-gray-600 transition-colors"
                          aria-label="Giảm"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="px-3 text-xs font-semibold text-gray-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                          className="p-1 hover:bg-gray-100 text-gray-600 transition-colors"
                          aria-label="Tăng"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(item.variantId)}
                        className="text-gray-400 hover:text-red-600 transition-colors p-1"
                        aria-label="Xóa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Drawer Footer */}
          {items.length > 0 && (
            <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 font-medium">Tạm tính (ước lượng):</span>
                <span className="text-lg font-black text-primary-800">
                  {formatCurrencyVND(totalPrice)}
                </span>
              </div>
              <div className="rounded-md bg-amber-50 p-2.5 border border-amber-200">
                <p className="text-[11px] text-amber-800 leading-tight">
                  <span className="font-semibold">Lưu ý giá:</span> Giá hiển thị ở giỏ hàng là tạm tính. Giá và tồn kho khả dụng thực tế sẽ được hệ thống máy chủ kiểm tra và xác nhận chính thức tại bước Đặt hàng.
                </p>
              </div>
              <div className="space-y-2 pt-1">
                <Button
                  onClick={() => {
                    setIsOpen(false);
                    router.push('/checkout');
                  }}
                  className="w-full justify-center space-x-2 font-semibold shadow-sm"
                >
                  <span>Tiến hành đặt hàng</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 justify-center text-xs text-gray-600"
                  >
                    Tiếp tục mua sắm
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confirm('Bạn có chắc chắn muốn xóa toàn bộ giỏ hàng?')) {
                        clearCart();
                      }
                    }}
                    className="px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    title="Xóa giỏ hàng"
                  >
                    Xóa hết
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
