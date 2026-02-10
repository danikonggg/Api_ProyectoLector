/**
 * ============================================
 * DTO: ActualizarEscuelaDto
 * ============================================
 * 
 * DTO para actualizar una escuela existente.
 * Todos los campos son opcionales.
 */

import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActualizarEscuelaDto {
  @ApiProperty({ example: 'Escuela Primaria Benito Juárez', description: 'Nombre completo de la escuela', maxLength: 150, required: false })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  nombre?: string;

  @ApiProperty({ example: 'Primaria', description: 'Nivel educativo', maxLength: 50, required: false })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  nivel?: string;

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
