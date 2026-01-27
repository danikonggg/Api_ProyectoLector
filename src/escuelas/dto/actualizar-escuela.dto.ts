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
  @ApiProperty({ 
    example: 'Escuela Primaria Benito Juárez',
    description: 'Nombre completo de la escuela',
    required: false,
    maxLength: 150
  })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  nombre?: string;

  @ApiProperty({ 
    example: 'Primaria',
    description: 'Nivel educativo',
    required: false,
    maxLength: 50
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  nivel?: string;

  @ApiProperty({ 
    example: '29DPR0123X',
    description: 'Clave de la escuela',
    required: false,
    maxLength: 50
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  clave?: string;

  @ApiProperty({ 
    example: 'Calle Principal #123, Col. Centro',
    description: 'Dirección completa de la escuela',
    required: false,
    maxLength: 200
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  direccion?: string;

  @ApiProperty({ 
    example: '5551234567',
    description: 'Teléfono de contacto de la escuela',
    required: false,
    maxLength: 20
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  telefono?: string;
}
