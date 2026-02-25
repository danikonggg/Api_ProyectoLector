import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, Max } from 'class-validator';

export class ActualizarProgresoLibroDto {
  @ApiProperty({ example: 45, description: 'Porcentaje de avance (0-100)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  porcentaje?: number;

  @ApiProperty({ example: 123, description: 'ID del último segmento leído (para retomar)' })
  @IsOptional()
  @IsInt()
  ultimoSegmentoId?: number;
}
