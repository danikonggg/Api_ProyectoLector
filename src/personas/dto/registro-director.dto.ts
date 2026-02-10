/**
 * ============================================
 * DTO: RegistroDirectorDto
 * ============================================
 * 
 * DTO para registrar un director/encargado de escuela.
 * Solo puede ser creado por un administrador.
 */

import { IsString, IsNotEmpty, IsEmail, IsOptional, IsDateString, IsNumber, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegistroDirectorDto {
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

  @ApiProperty({ example: 'director@example.com', description: 'Email', required: true })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', description: 'Contraseña (mín. 6)', minLength: 6, required: true })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '5551234567', description: 'Teléfono', required: false })
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiProperty({ example: '1975-05-15', description: 'Fecha de nacimiento (YYYY-MM-DD)', required: false })
  @IsDateString()
  @IsOptional()
  fechaNacimiento?: string;

  @ApiProperty({ example: 1, description: 'ID de la escuela de la que será director', required: true })
  @IsNumber()
  @IsNotEmpty()
  idEscuela: number;

  @ApiProperty({ example: '2020-01-15', description: 'Fecha de nombramiento (YYYY-MM-DD)', required: false })
  @IsDateString()
  @IsOptional()
  fechaNombramiento?: string;
}
