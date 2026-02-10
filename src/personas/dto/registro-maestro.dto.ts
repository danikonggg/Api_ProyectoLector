/**
 * ============================================
 * DTO: RegistroMaestroDto
 * ============================================
 * 
 * DTO para registrar un maestro/profesor.
 * Solo puede ser creado por un administrador.
 */

import { IsString, IsNotEmpty, IsEmail, IsOptional, IsDateString, IsNumber, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegistroMaestroDto {
  @ApiProperty({ example: 'Ana', description: 'Nombre', required: true })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'Rodríguez', description: 'Apellido paterno', required: true })
  @IsString()
  @IsNotEmpty()
  apellidoPaterno: string;

  @ApiProperty({ example: 'Fernández', description: 'Apellido materno', required: true })
  @IsString()
  @IsNotEmpty()
  apellidoMaterno: string;

  @ApiProperty({ example: 'maestro@example.com', description: 'Email', required: true })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', description: 'Contraseña (mín. 6)', minLength: 6, required: true })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '1111111111', description: 'Teléfono', required: false })
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiProperty({ example: '1988-07-10', description: 'Fecha de nacimiento (YYYY-MM-DD)', required: false })
  @IsDateString()
  @IsOptional()
  fechaNacimiento?: string;

  @ApiProperty({
    example: 1,
    description: 'ID de la escuela. Obligatorio para admin. Opcional para director (se usa su escuela).',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  idEscuela?: number;

  @ApiProperty({ example: 'Matemáticas', description: 'Especialidad o materia', required: false })
  @IsString()
  @IsOptional()
  especialidad?: string;

  @ApiProperty({ example: '2020-08-01', description: 'Fecha de ingreso (YYYY-MM-DD)', required: false })
  @IsDateString()
  @IsOptional()
  fechaIngreso?: string;
}
