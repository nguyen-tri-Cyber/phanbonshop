import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'farmer@example.com', description: 'Email tài khoản cần khôi phục' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Mã token khôi phục mật khẩu' })
  @IsString()
  @IsNotEmpty({ message: 'Reset token không được để trống' })
  resetToken!: string;

  @ApiProperty({ example: 'MatKhauMoi@456', description: 'Mật khẩu mới' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải chứa ít nhất 8 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Mật khẩu mới phải chứa ít nhất một chữ hoa, một chữ thường và một chữ số',
  })
  newPassword!: string;
}
