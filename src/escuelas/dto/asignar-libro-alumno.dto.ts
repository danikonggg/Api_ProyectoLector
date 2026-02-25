import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class AsignarLibroAlumnoDto {
  @ApiProperty({ example: 1, description: 'ID del alumno' })
  @IsInt()
  @IsPositive()
  alumnoId: number;

  @ApiProperty({ example: 1, description: 'ID del libro' })
  @IsInt()
  @IsPositive()
  libroId: number;
}
