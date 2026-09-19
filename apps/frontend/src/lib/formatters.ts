/**
 * Định dạng tiền tệ chuẩn vi-VN theo yêu cầu:
 * new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" })
 */
export function formatCurrencyVND(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '0 ₫';
  }
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(numeric);
}

/**
 * Định dạng thời gian theo múi giờ chuẩn Việt Nam (Asia/Ho_Chi_Minh)
 * Ví dụ: 14:30:00 19/09/2026
 */
export function formatDateTimeVN(date: string | Date | null | undefined): string {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '-';

    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return '-';
  }
}

/**
 * Định dạng ngày theo múi giờ chuẩn Việt Nam (Asia/Ho_Chi_Minh)
 * Ví dụ: 19/09/2026
 */
export function formatDateVN(date: string | Date | null | undefined): string {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '-';

    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return '-';
  }
}
