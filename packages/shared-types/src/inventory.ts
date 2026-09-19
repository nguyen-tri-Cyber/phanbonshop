/**
 * Inventory service contracts and DTOs (Kho vận & Lô hàng phân bón)
 */

import { FertilizerPackageUnit } from './product.js';

export enum StockMovementType {
  IMPORT_FACTORY = 'IMPORT_FACTORY',       // Nhập từ nhà máy / nhập khẩu
  EXPORT_ORDER = 'EXPORT_ORDER',           // Xuất bán đơn hàng
  TRANSFER_INTERNAL = 'TRANSFER_INTERNAL', // Điều chuyển nội bộ giữa các kho
  ADJUSTMENT = 'ADJUSTMENT',               // Kiểm kê cân đối kho
  DISPOSAL_EXPIRED = 'DISPOSAL_EXPIRED',   // Tiêu hủy hàng hết hạn / vỡ bao
}

export interface BatchLotDTO {
  id: string;
  batchNumber: string;       // Số lô sản xuất (theo quy chuẩn lưu hành phân bón)
  variantId: string;
  manufactureDate: string;   // Ngày sản xuất
  expiryDate: string;        // Hạn sử dụng
  initialQuantity: number;
  availableQuantity: number;
}

export interface WarehouseDTO {
  id: string;
  code: string;
  name: string;
  provinceName: string;
  address: string;
  managerPhone: string;
  isActive: boolean;
}

export interface InventoryStockDTO {
  variantId: string;
  warehouseId: string;
  unit: FertilizerPackageUnit;
  totalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  batches: BatchLotDTO[];
}
