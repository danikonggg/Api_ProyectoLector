/**
 * ============================================
 * DTO: Asignar libro a escuela por código
 * ============================================
 */

import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AsignarLibroEscuelaDto {
  @ApiProperty({
    example: 'LIB-1735123456-abc12345',
    description: 'Código del libro a asignar a la escuela',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  codigo: string;
}
