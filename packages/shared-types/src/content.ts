/**
 * Content service contracts and DTOs (Cẩm nang kỹ thuật & Tư vấn nông nghiệp)
 */

export enum ContentStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum ContentCategory {
  KY_THUAT_BON_PHAN = 'KY_THUAT_BON_PHAN', // Hướng dẫn bón phân theo giai đoạn
  LICH_MUA_VU = 'LICH_MUA_VU',             // Lịch mùa vụ nông nghiệp từng vùng miền
  BENH_HAI_CAY_TRONG = 'BENH_HAI_CAY_TRONG', // Phòng trừ sâu bệnh & thiếu dinh dưỡng
  GIA_CA_THI_TRUONG = 'GIA_CA_THI_TRUONG',   // Bản tin giá nông sản & vật tư
}

export interface AgriculturalArticleDTO {
  id: string;
  title: string;
  slug: string;
  category: ContentCategory;
  summary: string;
  contentMarkdown: string;
  targetCrops: string[];     // Phù hợp loại cây: Lúa, Cà phê, Sầu riêng...
  thumbnailUrl?: string;
  status: ContentStatus;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}
