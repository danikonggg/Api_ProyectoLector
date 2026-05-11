import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsInt, IsOptional, Min } from 'class-validator';

export class CrearSesionLecturaDto {
  @ApiProperty({ example: 847, description: 'Duración real en segundos' })
  @IsInt()
  @Min(0)
  duracionSegundos: number;

  @ApiProperty({ example: 3, description: 'Cuántos segmentos se leyeron en la sesión' })
  @IsInt()
  @Min(0)
  segmentosLeidos: number;

  @ApiPropertyOptional({ example: 5, description: 'Segmento donde inició la sesión' })
  @IsOptional()
  @IsInt()
  @Min(1)
  segmentoInicioId?: number | null;

  @ApiPropertyOptional({ example: 7, description: 'Segmento donde terminó la sesión' })
  @IsOptional()
  @IsInt()
  @Min(1)
  segmentoFinId?: number | null;

  @ApiProperty({ example: '2026-04-22T16:00:00.000Z' })
  @IsISO8601()
  fechaInicio: string;

  @ApiProperty({ example: '2026-04-22T16:14:07.000Z' })
  @IsISO8601()
  fechaFin: string;
}

