/**
 * ============================================
 * DTO: RegistroPadreConHijoDto
 * ============================================
 *
 * DTO para registrar un padre/tutor y un alumno (hijo) en una sola operación.
 * Endpoint: POST /personas/registro-padre-con-hijo
 */

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { RegistroPadreDto } from './registro-padre.dto';
import { RegistroAlumnoDto } from './registro-alumno.dto';

export class RegistroPadreConHijoDto {
  @ApiProperty({ type: RegistroPadreDto, required: true })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => RegistroPadreDto)
  padre: RegistroPadreDto;

  @ApiProperty({ type: RegistroAlumnoDto, required: true })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => RegistroAlumnoDto)
  hijo: RegistroAlumnoDto;
}

