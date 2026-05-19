import { IsArray, IsIn, IsInt, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RespuestaDiagnosticoItemDto {
  @IsInt()
  preguntaId: number;

  @IsString()
  @IsIn(['A', 'B', 'C', 'D'])
  respuesta: 'A' | 'B' | 'C' | 'D';
}

export class ResponderDiagnosticoDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RespuestaDiagnosticoItemDto)
  respuestas: RespuestaDiagnosticoItemDto[];
}
