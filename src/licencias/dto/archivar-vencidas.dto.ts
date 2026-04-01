/**
 * ============================================
 * DTO: Archivar licencias vencidas
 * ============================================
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class ArchivarVencidasDto {
  @ApiPropertyOptional({ example: 1, description: 'Filtrar por escuela (opcional)' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  escuelaId?: number;

  @ApiPropertyOptional({ example: 10, description: 'Filtrar por libro (opcional)' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  libroId?: number;
}

