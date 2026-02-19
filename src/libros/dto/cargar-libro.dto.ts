/**
 * ============================================
 * DTO: CargarLibroDto
 * ============================================
 * Metadatos para carga de libro (multipart: PDF + estos campos).
 */

import { IsString, IsNotEmpty, IsOptional, MaxLength, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { GRADO_MIN, GRADO_MAX, ID_MIN } from '../../common/constants/validation.constants';

export class CargarLibroDto {
  @ApiProperty({ example: 'Matemáticas 5to grado', description: 'Título del libro', maxLength: 150, required: true })
  @IsString()
  @IsNotEmpty({ message: 'El título del libro es obligatorio' })
  @MaxLength(150, { message: 'El título no puede superar 150 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  titulo: string;

  @ApiProperty({ example: 5, description: `Grado escolar (${GRADO_MIN}-${GRADO_MAX})`, required: true })
  @Transform(({ value }) => (value !== undefined && value !== '' ? parseInt(value, 10) : undefined))
  @IsInt({ message: 'El grado debe ser un número entero' })
  @IsNotEmpty({ message: 'El grado es obligatorio' })
  @Min(GRADO_MIN, { message: `El grado debe ser al menos ${GRADO_MIN}` })
  @Max(GRADO_MAX, { message: `El grado no puede ser mayor a ${GRADO_MAX}` })
  grado: number;

  @ApiProperty({ example: 1, description: 'ID de la materia', required: false })
  @Transform(({ value }) => (value !== undefined && value !== '' ? parseInt(value, 10) : undefined))
  @IsOptional()
  @IsInt({ message: 'El ID de la materia debe ser un número entero' })
  @Min(ID_MIN, { message: 'El ID de la materia debe ser un número positivo' })
  materiaId?: number;

  @ApiProperty({ example: 'MAT5-2024', description: 'Código del libro', maxLength: 50, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'El código no puede superar 50 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  codigo?: string;

  @ApiProperty({ example: 'Libro de matemáticas para quinto grado', description: 'Descripción del libro', maxLength: 255, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'La descripción no puede superar 255 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  descripcion?: string;
}
