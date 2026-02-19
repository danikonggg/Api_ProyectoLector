/**
 * ============================================
 * DTO: Asignar libro a escuela por código
 * ============================================
 */

import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AsignarLibroEscuelaDto {
  @ApiProperty({ example: 'LIB-1735123456-abc12345', description: 'Código del libro a asignar a la escuela', maxLength: 50, required: true })
  @IsString()
  @IsNotEmpty({ message: 'El código del libro es obligatorio' })
  @MinLength(1, { message: 'El código no puede estar vacío' })
  @MaxLength(50, { message: 'El código no puede superar 50 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  codigo: string;
}
