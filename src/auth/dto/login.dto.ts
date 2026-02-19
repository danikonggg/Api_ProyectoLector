/**
 * ============================================
 * DTO: LoginDto
 * ============================================
 * 
 * DTO para el login de usuarios.
 * Se usa el email y se genera un JWT token.
 */

import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { EMAIL_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../common/constants/validation.constants';

export class LoginDto {
  @ApiProperty({
    description: 'Email del usuario',
    example: 'admin@example.com',
    maxLength: EMAIL_MAX_LENGTH,
    required: true,
  })
  @IsEmail({}, { message: 'El correo debe tener un formato válido (ej: usuario@dominio.com)' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @MaxLength(EMAIL_MAX_LENGTH, { message: `El correo no puede superar ${EMAIL_MAX_LENGTH} caracteres` })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario (mínimo 6 caracteres)',
    example: 'password123',
    minLength: PASSWORD_MIN_LENGTH,
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(PASSWORD_MIN_LENGTH, { message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres` })
  password: string;
}
