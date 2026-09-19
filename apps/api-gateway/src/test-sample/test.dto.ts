import { IsNotEmpty, IsString, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SampleEchoDto {
  @ApiProperty({ example: 'Nguyễn Văn Nông', description: 'Tên người dùng' })
  @IsString({ message: 'Tên phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên không được để trống' })
  name!: string;

  @ApiProperty({ example: 'nongdan@phanbonshop.vn', description: 'Địa chỉ email' })
  @IsEmail({}, { message: 'Địa chỉ email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email!: string;
}
