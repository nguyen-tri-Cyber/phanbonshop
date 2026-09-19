/**
 * Kiểm tra số điện thoại di động Việt Nam hợp lệ
 * Đầu số phổ biến: 03, 05, 07, 08, 09 (gồm 10 chữ số) hoặc +84...
 */
export function isValidVNPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s.-]/g, '');
  const vnPhoneRegex = /^(0|\+84)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;
  return vnPhoneRegex.test(cleaned);
}

/**
 * Chuẩn hóa số điện thoại về định dạng 10 số bắt đầu bằng 0
 */
export function normalizeVNPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[\s.-]/g, '');
  if (cleaned.startsWith('+84')) {
    return '0' + cleaned.slice(3);
  }
  if (cleaned.startsWith('84') && cleaned.length === 11) {
    return '0' + cleaned.slice(2);
  }
  return cleaned;
}
