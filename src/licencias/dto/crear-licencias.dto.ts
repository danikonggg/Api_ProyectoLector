/**
 * ============================================
 * DTO: Crear lote de licencias
 * ============================================
 */

import { IsInt, IsPositive, IsDateString, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CrearLicenciasDto {
  @ApiProperty({ example: 1, description: 'ID de la escuela' })
  @IsInt()
  @IsPositive()
  escuelaId: number;

  @ApiProperty({ example: 1, description: 'ID del libro' })
  @IsInt()
  @IsPositive()
  libroId: number;

  @ApiProperty({ example: 50, description: 'Cantidad de licencias a generar', minimum: 1, maximum: 1000 })
  @IsInt()
  @Min(1, { message: 'La cantidad debe ser al menos 1' })
  @Max(1000, { message: 'La cantidad no puede superar 1000' })
  cantidad: number;

  @ApiProperty({ example: '2025-06-30', description: 'Fecha de vencimiento (ISO 8601)' })
  @IsDateString()
  fechaVencimiento: string;
}
