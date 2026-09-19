import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SyncCustomerProfileDto {
  @ApiProperty({ description: 'User ID đã được xác thực từ auth-service' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ description: 'Họ và tên khách hàng' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiPropertyOptional({ description: 'Số điện thoại' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Ảnh đại diện' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Họ và tên khách hàng' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Ảnh đại diện' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class CreateAddressDto {
  @ApiProperty({ example: 'Nguyễn Văn Nông' })
  @IsString()
  @IsNotEmpty()
  recipientName!: string;

  @ApiProperty({ example: '0912345678' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: '79' })
  @IsString()
  @IsNotEmpty()
  provinceCode!: string;

  @ApiProperty({ example: 'Thành phố Hồ Chí Minh' })
  @IsString()
  @IsNotEmpty()
  provinceName!: string;

  @ApiProperty({ example: '760' })
  @IsString()
  @IsNotEmpty()
  districtCode!: string;

  @ApiProperty({ example: 'Quận 1' })
  @IsString()
  @IsNotEmpty()
  districtName!: string;

  @ApiProperty({ example: '26734' })
  @IsString()
  @IsNotEmpty()
  wardCode!: string;

  @ApiProperty({ example: 'Phường Bến Nghé' })
  @IsString()
  @IsNotEmpty()
  wardName!: string;

  @ApiProperty({ example: '123 Đường Đồng Khởi' })
  @IsString()
  @IsNotEmpty()
  addressLine!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn Nông' })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiPropertyOptional({ example: '0912345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '79' })
  @IsOptional()
  @IsString()
  provinceCode?: string;

  @ApiPropertyOptional({ example: 'Thành phố Hồ Chí Minh' })
  @IsOptional()
  @IsString()
  provinceName?: string;

  @ApiPropertyOptional({ example: '760' })
  @IsOptional()
  @IsString()
  districtCode?: string;

  @ApiPropertyOptional({ example: 'Quận 1' })
  @IsOptional()
  @IsString()
  districtName?: string;

  @ApiPropertyOptional({ example: '26734' })
  @IsOptional()
  @IsString()
  wardCode?: string;

  @ApiPropertyOptional({ example: 'Phường Bến Nghé' })
  @IsOptional()
  @IsString()
  wardName?: string;

  @ApiPropertyOptional({ example: '123 Đường Đồng Khởi' })
  @IsOptional()
  @IsString()
  addressLine?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
