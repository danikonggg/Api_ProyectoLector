/**
 * ============================================
 * DTO: AsignarAlumnoDto
 * ============================================
 * Asignar un alumno a la clase del maestro (por materia).
 */

import { IsInt, Min, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ID_MIN } from '../../common/constants/validation.constants';

export class AsignarAlumnoDto {
  @ApiProperty({ example: 1, description: 'ID del alumno', required: true })
  @IsInt({ message: 'El ID del alumno debe ser un número entero' })
  @IsNotEmpty({ message: 'El ID del alumno es obligatorio' })
  @Min(ID_MIN, { message: 'El ID del alumno debe ser un número positivo' })
  alumnoId: number;

  @ApiProperty({ example: 1, description: 'ID de la materia', required: true })
  @IsInt({ message: 'El ID de la materia debe ser un número entero' })
  @IsNotEmpty({ message: 'El ID de la materia es obligatorio' })
  @Min(ID_MIN, { message: 'El ID de la materia debe ser un número positivo' })
  materiaId: number;
}
