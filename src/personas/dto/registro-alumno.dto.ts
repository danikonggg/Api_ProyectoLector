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
  @ApiProperty({ example: 'Carlos', description: 'Nombre', required: true })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'González', description: 'Apellido paterno', required: true })
  @IsString()
  @IsNotEmpty()
  apellidoPaterno: string;

  @ApiProperty({ example: 'Sánchez', description: 'Apellido materno', required: true })
  @IsString()
  @IsNotEmpty()
  apellidoMaterno: string;

  @ApiProperty({ example: 'alumno@example.com', description: 'Email', required: true })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', description: 'Contraseña (mín. 6)', minLength: 6, required: true })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '5555555555', description: 'Teléfono', required: false })
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiProperty({ example: '2010-03-20', description: 'Fecha de nacimiento (YYYY-MM-DD)', required: false })
  @IsDateString()
  @IsOptional()
  fechaNacimiento?: string;

  @ApiProperty({ example: 1, description: 'ID de la escuela. Obligatorio para admin. Opcional para director.', required: false })
  @IsNumber()
  @IsOptional()
  idEscuela?: number;

  @ApiProperty({ example: 1, description: 'Grado escolar (1-6)', required: false })
  @IsNumber()
  @IsOptional()
  grado?: number;

  @ApiProperty({ example: 'A', description: 'Grupo o sección', required: false })
  @IsString()
  @IsOptional()
  grupo?: string;

  @ApiProperty({ example: '2024-2025', description: 'Ciclo escolar', required: false })
  @IsString()
  @IsOptional()
  cicloEscolar?: string;
}
