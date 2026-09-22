import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleLoginDto {
  @ApiProperty({ description: 'Google Identity Services ID token' })
  @IsString({ message: 'Google credential phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Google credential không được để trống' })
  @MaxLength(10000, { message: 'Google credential không hợp lệ' })
  credential!: string;
}
