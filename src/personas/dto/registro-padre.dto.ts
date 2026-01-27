/**
 * ============================================
 * DTO: RegistroPadreDto
 * ============================================
 * 
 * DTO para registrar un padre/tutor.
 * Solo puede ser creado por un administrador.
 */

import { IsString, IsNotEmpty, IsEmail, IsOptional, IsDateString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegistroPadreDto {
  @ApiProperty({ example: 'María' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'López' })
  @IsString()
  @IsNotEmpty()
  apellidoPaterno: string;

  @ApiProperty({ example: 'Martínez' })
  @IsString()
  @IsNotEmpty()
  apellidoMaterno: string;

  @ApiProperty({ example: 'padre@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '0987654321', required: false })
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiProperty({ example: '1985-05-15', required: false })
  @IsDateString()
  @IsOptional()
  fechaNacimiento?: string;
}
