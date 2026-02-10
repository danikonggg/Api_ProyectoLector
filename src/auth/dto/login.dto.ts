/**
 * ============================================
 * DTO: LoginDto
 * ============================================
 * 
 * DTO para el login de usuarios.
 * Se usa el email y se genera un JWT token.
 */

import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Email del usuario',
    example: 'admin@example.com',
    required: true,
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario (mínimo 6 caracteres)',
    example: 'password123',
    minLength: 6,
    required: true,
  })
  @IsNotEmpty()
  password: string;
}
