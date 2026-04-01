/**
 * DTO para crear una materia.
 */

import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateMateriaDto {
  @ApiProperty({ example: 'Matemáticas', description: 'Nombre de la materia', maxLength: 100, required: true })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la materia es obligatorio' })
  @MaxLength(100, { message: 'El nombre no puede superar 100 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nombre: string;

  @ApiProperty({ example: 'Matemáticas para primaria', description: 'Descripción', maxLength: 255, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'La descripción no puede superar 255 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  descripcion?: string;

  @ApiProperty({ example: 'General', description: 'Nivel (ej. General, Primaria, Secundaria)', maxLength: 50, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'El nivel no puede superar 50 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nivel?: string;
}
