import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DesvincularAlumnoDto {
  @ApiProperty({
    example: 1,
    description: 'ID del alumno a desvincular del tutor',
  })
  @IsInt()
  @IsNotEmpty({ message: 'El ID del alumno es obligatorio' })
  @Min(1, { message: 'El ID del alumno debe ser mayor a 0' })
  @Type(() => Number)
  alumnoId: number;
}
