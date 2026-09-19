import { MoneyVND } from '@phanbonshop/shared-types';

/**
 * Định dạng số tiền sang chuẩn Việt Nam Đồng (VND)
 * Ví dụ: 250000 -> "250.000 ₫"
 */
export function formatVND(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = new Intl.NumberFormat('vi-VN').format(rounded);
  return `${formatted} ₫`;
}

/**
 * Tạo object MoneyVND chuẩn
 */
export function createMoneyVND(amount: number): MoneyVND {
  return {
    amount: Math.round(amount),
    currency: 'VND',
  };
}
