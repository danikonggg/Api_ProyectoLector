/**
 * ============================================
 * DTO: CargarLibroDto
 * ============================================
 * Metadatos para carga de libro (multipart: PDF + estos campos).
 */

import { IsString, IsNotEmpty, IsNumber, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CargarLibroDto {
  @ApiProperty({ example: 'Matemáticas 5to grado', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  titulo: string;

  @ApiProperty({ example: 5, description: 'Grado escolar' })
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  @IsNotEmpty()
  grado: number;

  @ApiProperty({ example: 1, description: 'ID de la materia (opcional; por ahora solo libros de lectura)', required: false })
  @Transform(({ value }) => (value !== undefined && value !== '' ? parseInt(value, 10) : undefined))
  @IsNumber()
  @IsOptional()
  materiaId?: number;

  @ApiProperty({ example: 'MAT5-2024', required: false, maxLength: 50 })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  codigo?: string;

  @ApiProperty({ example: 'Libro de matemáticas para quinto grado', required: false, maxLength: 255 })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  descripcion?: string;
}
