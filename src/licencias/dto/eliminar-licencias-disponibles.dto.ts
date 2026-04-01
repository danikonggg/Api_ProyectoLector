/**
 * DTO: Eliminar licencias disponibles (por error al generar)
 * Todos los campos son opcionales. Si no envías ninguno, borra TODAS las licencias disponibles del sistema.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class EliminarLicenciasDisponiblesDto {
  @ApiPropertyOptional({
    example: 1,
    description:
      'Filtrar por escuela. Si no se envía, elimina de todas las escuelas.',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  escuelaId?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Filtrar por libro. Si no se envía, elimina de todos los libros.',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  libroId?: number;

  @ApiPropertyOptional({
    example: 50,
    description:
      'Máximo de licencias a eliminar. Si no se envía, elimina todas las que coincidan con los filtros.',
    minimum: 1,
    maximum: 10000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  cantidad?: number;
}
