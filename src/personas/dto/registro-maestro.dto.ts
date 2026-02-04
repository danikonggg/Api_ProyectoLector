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
  @ApiProperty({ example: 'Ana' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'Rodríguez' })
  @IsString()
  @IsNotEmpty()
  apellidoPaterno: string;

  @ApiProperty({ example: 'Fernández' })
  @IsString()
  @IsNotEmpty()
  apellidoMaterno: string;

  @ApiProperty({ example: 'maestro@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '1111111111', required: false })
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiProperty({ example: '1988-07-10', required: false })
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

  @IsString()
  @IsOptional()
  especialidad?: string;

  @IsDateString()
  @IsOptional()
  fechaIngreso?: string;
}
