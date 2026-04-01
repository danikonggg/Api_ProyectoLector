/**
 * DTO para actualizar una materia. Todos los campos son opcionales.
 */

import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateMateriaDto {
  @ApiPropertyOptional({ example: 'Matemáticas', description: 'Nombre de la materia', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'El nombre no puede superar 100 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nombre?: string;

  @ApiPropertyOptional({ example: 'Matemáticas para primaria', description: 'Descripción', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'La descripción no puede superar 255 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  descripcion?: string;

  @ApiPropertyOptional({ example: 'General', description: 'Nivel', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'El nivel no puede superar 50 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nivel?: string;
}
