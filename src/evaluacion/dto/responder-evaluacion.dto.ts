import { IsArray, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RespuestaEvaluacionItemDto {
  @IsInt()
  preguntaId: number;

  @IsString()
  @IsIn(['A', 'B', 'C', 'D'])
  respuesta: 'A' | 'B' | 'C' | 'D';

  @IsOptional()
  @IsInt()
  tiempoMs?: number;
}

export class ResponderEvaluacionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RespuestaEvaluacionItemDto)
  respuestas: RespuestaEvaluacionItemDto[];
}
