/**
 * ============================================
 * DTO: AsignarAlumnoDto
 * ============================================
 * Asignar un alumno a la clase del maestro (por materia).
 */

import { IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AsignarAlumnoDto {
  @ApiProperty({ example: 1, description: 'ID del alumno' })
  @IsNumber()
  @IsNotEmpty()
  alumnoId: number;

  @ApiProperty({ example: 1, description: 'ID de la materia' })
  @IsNumber()
  @IsNotEmpty()
  materiaId: number;
}
