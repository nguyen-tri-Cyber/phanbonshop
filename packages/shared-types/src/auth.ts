/**
 * Auth service contracts and DTOs
 */

export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  AGENCY_TIER_1 = 'AGENCY_TIER_1', // Đại lý cấp 1
  AGENCY_TIER_2 = 'AGENCY_TIER_2', // Đại lý cấp 2
  FARMER = 'FARMER',               // Nhà nông
  GUEST = 'GUEST',
}

export interface JwtPayload {
  sub: string; // User ID
  phoneNumber: string;
  role: UserRole;
  email?: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface UserSummaryDTO {
  id: string;
  phoneNumber: string;
  fullName: string;
  role: UserRole;
  email?: string;
  isActive: boolean;
  createdAt: string;
}
