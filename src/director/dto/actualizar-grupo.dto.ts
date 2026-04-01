import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsString, MaxLength, IsBoolean, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class ActualizarGrupoDto {
  @ApiPropertyOptional({ example: 1, description: 'Grado escolar' })
  @IsOptional()
  @IsInt()
  @Min(1)
  grado?: number;

  @ApiPropertyOptional({ example: 'B', description: 'Nombre del grupo/sección' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nombre?: string;

  @ApiPropertyOptional({ example: true, description: 'Si el grupo está activo' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({
    example: [5, 7],
    description: 'IDs de maestros asignados al grupo. Reemplaza la lista actual. [] quita todos.',
    type: 'array',
    items: { type: 'number' },
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  maestroIds?: number[];

  @ApiPropertyOptional({
    example: [10, 11, 12],
    description: 'IDs de alumnos en este grupo. Reemplaza la lista actual. [] quita a todos del grupo.',
    type: 'array',
    items: { type: 'number' },
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  alumnoIds?: number[];
}
