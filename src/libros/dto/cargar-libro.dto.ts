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
  @ApiProperty({ example: 'Matemáticas 5to grado', description: 'Título del libro', maxLength: 150, required: true })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  titulo: string;

  @ApiProperty({ example: 5, description: 'Grado escolar (1-6)', required: true })
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  @IsNotEmpty()
  grado: number;

  @ApiProperty({ example: 1, description: 'ID de la materia', required: false })
  @Transform(({ value }) => (value !== undefined && value !== '' ? parseInt(value, 10) : undefined))
  @IsNumber()
  @IsOptional()
  materiaId?: number;

  @ApiProperty({ example: 'MAT5-2024', description: 'Código del libro', maxLength: 50, required: false })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  codigo?: string;

  @ApiProperty({ example: 'Libro de matemáticas para quinto grado', description: 'Descripción del libro', maxLength: 255, required: false })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  descripcion?: string;
}
