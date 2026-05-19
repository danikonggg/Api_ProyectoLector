import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PASSWORD_MIN_LENGTH } from '../../common/constants/validation.constants';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Token de restablecimiento recibido por correo',
    example: 'a1b2c3d4e5f6...',
  })
  @IsString()
  @IsNotEmpty({ message: 'El token es obligatorio' })
  token: string;

  @ApiProperty({
    description: 'Nueva contraseña (mínimo 6 caracteres)',
    example: 'NuevaPass123',
    minLength: PASSWORD_MIN_LENGTH,
  })
  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
  })
  @MaxLength(100, { message: 'La contraseña no puede superar 100 caracteres' })
  nuevaPassword: string;
}
