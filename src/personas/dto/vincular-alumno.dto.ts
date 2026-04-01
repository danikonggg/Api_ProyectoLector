import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VincularAlumnoDto {
  @ApiProperty({
    example: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
    description: 'Código único de vinculación padre–alumno',
  })
  @IsString()
  @IsNotEmpty({ message: 'El código de vinculación es obligatorio' })
  @MaxLength(64, { message: 'El código de vinculación no puede superar 64 caracteres' })
  codigo: string;
}

