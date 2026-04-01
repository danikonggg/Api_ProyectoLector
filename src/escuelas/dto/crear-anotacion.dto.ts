import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearAnotacionDto {
  @ApiProperty({ example: 10, description: 'ID del libro' })
  @IsInt()
  @Min(1)
  libroId: number;

  @ApiProperty({ example: 120, description: 'ID del segmento' })
  @IsInt()
  @Min(1)
  segmentoId: number;

  @ApiProperty({ example: 'highlight', enum: ['highlight', 'comentario'] })
  @IsIn(['highlight', 'comentario'])
  tipo: 'highlight' | 'comentario';

  @ApiProperty({ example: 'Texto seleccionado por el alumno' })
  @IsString()
  @IsNotEmpty()
  textoSeleccionado: string;

  @ApiProperty({ example: 5, description: 'Offset inicial dentro del segmento' })
  @IsInt()
  @Min(0)
  offsetInicio: number;

  @ApiProperty({ example: 30, description: 'Offset final dentro del segmento' })
  @IsInt()
  @Min(1)
  offsetFin: number;

  @ApiPropertyOptional({ example: 'amarillo', enum: ['amarillo', 'verde', 'rosa', 'azul'] })
  @IsOptional()
  @IsIn(['amarillo', 'verde', 'rosa', 'azul'])
  color?: 'amarillo' | 'verde' | 'rosa' | 'azul';

  @ApiPropertyOptional({ example: 'Repasar este fragmento' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comentario?: string;
}
