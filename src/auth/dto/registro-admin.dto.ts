/**
 * ============================================
 * DTO: RegistroAdminDto (con contraseña)
 * ============================================
 * 
 * DTO para registrar un administrador con contraseña.
 */

import { IsString, IsNotEmpty, IsEmail, IsOptional, IsDateString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegistroAdminDto {
  @ApiProperty({ example: 'Juan' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  @IsNotEmpty()
  apellidoPaterno: string;

  @ApiProperty({ example: 'García' })
  @IsString()
  @IsNotEmpty()
  apellidoMaterno: string;

  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '1234567890', required: false })
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiProperty({ example: '1990-01-01', required: false })
  @IsDateString()
  @IsOptional()
  fechaNacimiento?: string;

  @ApiProperty({ example: 'super', required: false })
  @IsString()
  @IsOptional()
  nivel?: string;
}
