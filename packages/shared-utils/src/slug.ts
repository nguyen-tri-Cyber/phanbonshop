/**
 * Chuyển đổi văn bản tiếng Việt có dấu thành slug thân thiện SEO
 * Ví dụ: "Phân Bón NPK Đầu Trâu 20-20-15" -> "phan-bon-npk-dau-trau-20-20-15"
 */
export function toVietnameseSlug(text: string): string {
  if (!text) return '';

  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/([^0-9a-z-\s])/g, '')
    .replace(/(\s+)/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
