/**
 * ============================================
 * DTO: RegistroPadreDto
 * ============================================
 * 
 * DTO para registrar un padre/tutor.
 * Solo puede ser creado por un administrador.
 */

import { IsString, IsNotEmpty, IsEmail, IsOptional, IsDateString, IsNumber, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegistroPadreDto {
  @ApiProperty({ example: 'María', description: 'Nombre', required: true })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'López', description: 'Apellido paterno', required: true })
  @IsString()
  @IsNotEmpty()
  apellidoPaterno: string;

  @ApiProperty({ example: 'Martínez', description: 'Apellido materno', required: true })
  @IsString()
  @IsNotEmpty()
  apellidoMaterno: string;

  @ApiProperty({ example: 'padre@example.com', description: 'Email', required: true })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', description: 'Contraseña (mín. 6)', minLength: 6, required: true })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '0987654321', description: 'Teléfono', required: false })
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiProperty({ example: '1985-05-15', description: 'Fecha de nacimiento (YYYY-MM-DD)', required: false })
  @IsDateString()
  @IsOptional()
  fechaNacimiento?: string;

  @ApiProperty({ example: 1, description: 'ID del alumno. Si se envía, vincula al padre para ver sus avances.', required: false })
  @IsNumber()
  @IsOptional()
  alumnoId?: number;
}
