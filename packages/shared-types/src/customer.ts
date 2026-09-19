/**
 * Customer service contracts and DTOs
 */

import { AddressVN } from './common.js';

export enum CustomerType {
  FARMER = 'FARMER',                     // Nông dân cá thể
  COOPERATIVE = 'COOPERATIVE',           // Hợp tác xã nông nghiệp
  AGENCY_TIER_1 = 'AGENCY_TIER_1',       // Đại lý phân bón cấp 1
  AGENCY_TIER_2 = 'AGENCY_TIER_2',       // Đại lý phân bón cấp 2
  ENTERPRISE = 'ENTERPRISE',             // Nông trường / Doanh nghiệp nông nghiệp
}

export enum CustomerTier {
  STANDARD = 'STANDARD',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  DIAMOND = 'DIAMOND',
}

export interface CustomerProfileDTO {
  id: string;
  userId: string;
  customerType: CustomerType;
  tier: CustomerTier;
  fullName: string;
  phoneNumber: string;
  taxCode?: string;            // Mã số thuế (đối với đại lý/hợp tác xã)
  businessLicense?: string;    // Giấy phép kinh doanh phân bón
  address: AddressVN;
  farmingAreaHectares?: number;// Diện tích canh tác (đối với nông dân)
  mainCrops?: string[];        // Cây trồng chủ lực (lúa, cà phê, sầu riêng, tiêu...)
  creditLimitVND?: number;     // Hạn mức công nợ
  rewardPoints: number;
}

export interface CustomerAddressDTO {
  id: string;
  customerId: string;
  recipientName: string;
  phone: string;
  provinceCode: string;
  provinceName: string;
  districtCode: string;
  districtName: string;
  wardCode: string;
  wardName: string;
  addressLine: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VietnamWard {
  code: string;
  name: string;
}

export interface VietnamDistrict {
  code: string;
  name: string;
  wards: VietnamWard[];
}

export interface VietnamProvince {
  code: string;
  name: string;
  districts: VietnamDistrict[];
}

export interface VietnamDivisionsDataset {
  version: string;
  updatedAt: string;
  provinces: VietnamProvince[];
}
