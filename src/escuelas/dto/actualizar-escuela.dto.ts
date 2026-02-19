/**
 * ============================================
 * DTO: ActualizarEscuelaDto
 * ============================================
 * 
 * DTO para actualizar una escuela existente.
 * Todos los campos son opcionales.
 */

import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

const ESTADOS_ESCUELA = ['activa', 'suspendida', 'inactiva'] as const;

export class ActualizarEscuelaDto {
  @ApiProperty({ example: 'Escuela Primaria Benito Juárez', description: 'Nombre completo de la escuela', maxLength: 150, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'El nombre no puede superar 150 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nombre?: string;

  @ApiProperty({ example: 'Primaria', description: 'Nivel educativo', maxLength: 50, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'El nivel no puede superar 50 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nivel?: string;

  @ApiProperty({ example: '29DPR0123X', description: 'Clave de la escuela', maxLength: 50, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'La clave no puede superar 50 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  clave?: string;

  @ApiProperty({ example: 'Calle Principal #123, Col. Centro', description: 'Dirección completa', maxLength: 200, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'La dirección no puede superar 200 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  direccion?: string;

  @ApiProperty({ example: '5551234567', description: 'Teléfono de contacto', maxLength: 20, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'El teléfono no puede superar 20 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  telefono?: string;

  @ApiProperty({ example: 'activa', description: 'Estado: activa, suspendida, inactiva', enum: ESTADOS_ESCUELA, required: false })
  @IsOptional()
  @IsIn(ESTADOS_ESCUELA, { message: 'El estado debe ser uno de: activa, suspendida, inactiva' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  estado?: string;

  @ApiProperty({ example: 'Ciudad de México', description: 'Ciudad de la escuela', maxLength: 100, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'La ciudad no puede superar 100 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  ciudad?: string;

  @ApiProperty({ example: 'CDMX', description: 'Estado o región', maxLength: 100, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'El estado o región no puede superar 100 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  estadoRegion?: string;
}
