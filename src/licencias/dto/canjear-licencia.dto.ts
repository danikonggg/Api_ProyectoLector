/**
 * ============================================
 * DTO: Canjear licencia (solo alumno, usa alumnoId del token)
 * ============================================
 */

import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CanjearLicenciaDto {
  @ApiProperty({ example: 'LECT-A1B2-C3D4-E5F6', description: 'Clave de la licencia' })
  @IsString()
  @IsNotEmpty({ message: 'La clave de la licencia es obligatoria' })
  clave: string;
}
