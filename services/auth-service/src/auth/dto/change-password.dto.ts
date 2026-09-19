import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'MatKhauCu@123', description: 'Mật khẩu hiện tại' })
  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu cũ không được để trống' })
  oldPassword!: string;

  @ApiProperty({ example: 'MatKhauMoi@456', description: 'Mật khẩu mới' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải chứa ít nhất 8 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Mật khẩu mới phải chứa ít nhất một chữ hoa, một chữ thường và một chữ số',
  })
  newPassword!: string;
}
