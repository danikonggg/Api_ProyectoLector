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
  @ApiProperty({ example: 'Juan', description: 'Nombre', required: true })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'Pérez', description: 'Apellido paterno', required: true })
  @IsString()
  @IsNotEmpty()
  apellidoPaterno: string;

  @ApiProperty({ example: 'García', description: 'Apellido materno', required: true })
  @IsString()
  @IsNotEmpty()
  apellidoMaterno: string;

  @ApiProperty({ example: 'admin@example.com', description: 'Email', required: true })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', description: 'Contraseña (mín. 6)', minLength: 6, required: true })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '1234567890', description: 'Teléfono', required: false })
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiProperty({ example: '1990-01-01', description: 'Fecha de nacimiento (YYYY-MM-DD)', required: false })
  @IsDateString()
  @IsOptional()
  fechaNacimiento?: string;

  @ApiProperty({ example: 'super', description: 'Nivel de administrador', required: false })
  @IsString()
  @IsOptional()
  nivel?: string;
}
