import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class RespuestaEvaluacionDto {
  @IsInt()
  preguntaId: number;

  @IsString()
  @IsIn(['A', 'B', 'C', 'D'])
  respuesta: 'A' | 'B' | 'C' | 'D';

  @IsOptional()
  @IsInt()
  tiempoMs?: number;
}

export class ResponderEvaluacionSegmentoDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RespuestaEvaluacionDto)
  respuestas: RespuestaEvaluacionDto[];

  @IsOptional()
  @IsString()
  nivel?: 'basico' | 'intermedio' | 'avanzado';
}
