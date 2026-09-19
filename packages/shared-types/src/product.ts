/**
 * Product service contracts and DTOs (Phân bón & Nông nghiệp)
 */

export enum FertilizerCategory {
  NPK = 'NPK',                         // Phân NPK hỗn hợp
  HUU_CO = 'HUU_CO',                   // Phân hữu cơ / vi sinh
  VO_CO_DON = 'VO_CO_DON',             // Phân đạm, lân, kali đơn
  VI_LUONG = 'VI_LUONG',               // Phân vi lượng (TE)
  PHAN_BON_LA = 'PHAN_BON_LA',         // Phân bón lá
  CAI_TAO_DAT = 'CAI_TAO_DAT',         // Phân bón cải tạo đất
  CHEP_PHAM_SINH_HOC = 'SINH_HOC',     // Chế phẩm sinh học
}

export enum FertilizerPackageUnit {
  BAO_50KG = 'BAO_50KG',
  BAO_25KG = 'BAO_25KG',
  BAO_10KG = 'BAO_10KG',
  CAN_20L = 'CAN_20L',
  CAN_5L = 'CAN_5L',
  CHAI_1L = 'CHAI_1L',
  CHAI_500ML = 'CHAI_500ML',
  GOI_1KG = 'GOI_1KG',
}

export enum ProductStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

export interface FertilizerVariantDTO {
  id: string;
  productId: string;
  sku: string;
  barcode?: string;
  unit: FertilizerPackageUnit;
  weightKg?: number;
  volumeLiters?: number;
  originalPriceVND: number;
  salePriceVND: number;
  wholesalePriceTier1VND?: number;
  wholesalePriceTier2VND?: number;
  isActive: boolean;
}

export interface ProductDTO {
  id: string;
  name: string;
  slug: string;
  category: FertilizerCategory;
  brand: string;
  originCountry: string;
  compositionSummary: string; // Tóm tắt thành phần (N-P-K, hữu cơ, TE...)
  usageInstructions: string;  // Hướng dẫn sử dụng cây trồng
  status: ProductStatus;
  variants: FertilizerVariantDTO[];
  createdAt: string;
  updatedAt: string;
}
