/**
 * ============================================
 * DTO: RegistroAlumnoDto
 * ============================================
 * 
 * DTO para registrar un alumno.
 * Solo puede ser creado por un administrador.
 */

import { IsString, IsNotEmpty, IsEmail, IsOptional, IsDateString, IsNumber, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegistroAlumnoDto {
  @ApiProperty({ example: 'Carlos' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'González' })
  @IsString()
  @IsNotEmpty()
  apellidoPaterno: string;

  @ApiProperty({ example: 'Sánchez' })
  @IsString()
  @IsNotEmpty()
  apellidoMaterno: string;

  @ApiProperty({ example: 'alumno@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '5555555555', required: false })
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiProperty({ example: '2010-03-20', required: false })
  @IsDateString()
  @IsOptional()
  fechaNacimiento?: string;

  @ApiProperty({
    example: 1,
    description:
      'ID de la escuela. Obligatorio para admin. Opcional para director (se usa su escuela automáticamente).',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  idEscuela?: number;

  @IsNumber()
  @IsOptional()
  grado?: number;

  @IsString()
  @IsOptional()
  grupo?: string;

  @IsString()
  @IsOptional()
  cicloEscolar?: string;
}
