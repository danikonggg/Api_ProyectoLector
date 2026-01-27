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

  @ApiProperty({ example: 'director@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '5551234567', required: false })
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiProperty({ example: '1975-05-15', required: false })
  @IsDateString()
  @IsOptional()
  fechaNacimiento?: string;

  @ApiProperty({ 
    example: 1,
    description: 'ID de la escuela de la que será director',
    required: true
  })
  @IsNumber()
  @IsNotEmpty()
  idEscuela: number;

  @ApiProperty({ example: '2020-01-15', required: false })
  @IsDateString()
  @IsOptional()
  fechaNombramiento?: string;
}
