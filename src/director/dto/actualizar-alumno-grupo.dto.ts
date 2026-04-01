import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsPositive, IsOptional, ValidateIf } from 'class-validator';

export class ActualizarAlumnoGrupoDto {
  @ApiPropertyOptional({
    example: 2,
    description: 'ID del grupo al que se mueve el alumno. Omitir o null para quitar del grupo.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsInt()
  @IsPositive()
  grupoId?: number | null;
}
