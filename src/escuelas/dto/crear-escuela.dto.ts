/**
 * ============================================
 * DTO: CrearEscuelaDto
 * ============================================
 * 
 * DTO para crear una nueva escuela.
 * Solo puede ser creada por un administrador.
 */

import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CrearEscuelaDto {
  @ApiProperty({ example: 'Escuela Primaria Benito Juárez', description: 'Nombre completo de la escuela', maxLength: 150, required: true })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @ApiProperty({ example: 'Primaria', description: 'Nivel educativo (Primaria, Secundaria, etc.)', maxLength: 50, required: true })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nivel: string;

  @ApiProperty({ example: '29DPR0123X', description: 'Clave de la escuela', maxLength: 50, required: false })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  clave?: string;

  @ApiProperty({ example: 'Calle Principal #123, Col. Centro', description: 'Dirección completa', maxLength: 200, required: false })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  direccion?: string;

  @ApiProperty({ example: '5551234567', description: 'Teléfono de contacto', maxLength: 20, required: false })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  telefono?: string;
}
