import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { TemaLector } from '../entities/preferencias-alumno.entity';

export class PatchPreferenciasDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  ocultarTutorialLector?: boolean;

  @ApiPropertyOptional({ example: 'sepia', enum: ['sepia', 'oscuro', 'claro'] })
  @IsOptional()
  @IsIn(['sepia', 'oscuro', 'claro'])
  temaLector?: TemaLector;

  @ApiPropertyOptional({ example: 'es' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  idioma?: string;
}

