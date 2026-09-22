export interface ShippingCalculationInput {
  provinceCode: string;
  subtotal: number;
  isFreeShippingCoupon?: boolean;
}

export interface ShippingCalculationResult {
  shippingFee: number;
  originalShippingFee: number;
  isFreeShipping: boolean;
  region: string;
  reason?: string;
}

export const FREE_SHIPPING_THRESHOLD = 2000000; // Đơn từ 2.000.000đ miễn phí vận chuyển nông nghiệp

// Mã tỉnh miền Tây (Đồng bằng sông Cửu Long)
const MEKONG_DELTA_PROVINCE_CODES = new Set([
  '80', // Long An
  '82', // Tiền Giang
  '83', // Bến Tre
  '84', // Trà Vinh
  '86', // Vĩnh Long
  '87', // Đồng Tháp
  '89', // An Giang
  '91', // Kiên Giang
  '92', // Cần Thơ
  '93', // Hậu Giang
  '94', // Sóc Trăng
  '95', // Bạc Liêu
  '96', // Cà Mau
]);

// Mã tỉnh miền Đông Nam Bộ & Tây Nguyên
const SOUTHEAST_AND_CENTRAL_HIGHLANDS = new Set([
  '62', // Kon Tum
  '64', // Gia Lai
  '66', // Đắk Lắk
  '67', // Đắk Nông
  '68', // Lâm Đồng
  '70', // Bình Phước
  '72', // Tây Ninh
  '74', // Bình Dương
  '75', // Đồng Nai
  '77', // Bà Rịa - Vũng Tàu
  '79', // TP. Hồ Chí Minh
]);

/**
 * Tính toán cước phí vận chuyển phân bón hoàn toàn ở Server-side
 * - Phân vùng địa lý chuyên canh nông nghiệp
 * - Miễn phí vận chuyển (Free shipping) khi đơn hàng đạt ngưỡng
 */
export function calculateShippingFee(input: ShippingCalculationInput): ShippingCalculationResult {
  let baseRate = 80000; // Mặc định miền Trung và miền Bắc: 80.000đ
  let region = 'Miền Trung & Miền Bắc';

  if (MEKONG_DELTA_PROVINCE_CODES.has(input.provinceCode)) {
    baseRate = 50000; // Miền Tây (vựa lúa & cây ăn trái ĐBSCL): 50.000đ
    region = 'Đồng bằng sông Cửu Long (Miền Tây)';
  } else if (SOUTHEAST_AND_CENTRAL_HIGHLANDS.has(input.provinceCode)) {
    baseRate = 60000; // Đông Nam Bộ & Tây Nguyên (thủ phủ cà phê, sầu riêng): 60.000đ
    region = 'Đông Nam Bộ & Tây Nguyên';
  }

  // Nếu có mã coupon FREESHIP
  if (input.isFreeShippingCoupon) {
    return {
      shippingFee: 0,
      originalShippingFee: baseRate,
      isFreeShipping: true,
      region,
      reason: 'Áp dụng mã miễn phí vận chuyển',
    };
  }

  // Nếu đạt ngưỡng miễn phí giao hàng toàn sàn (>= 2.000.000đ)
  if (input.subtotal >= FREE_SHIPPING_THRESHOLD) {
    return {
      shippingFee: 0,
      originalShippingFee: baseRate,
      isFreeShipping: true,
      region,
      reason: 'Miễn phí giao hàng mùa vụ cho đơn từ 2.000.000đ',
    };
  }

  return {
    shippingFee: baseRate,
    originalShippingFee: baseRate,
    isFreeShipping: false,
    region,
  };
}
