import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class RespuestaEvaluacionDto {
  @IsString()
  preguntaId: string;

  @IsString()
  respuesta: string;
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
