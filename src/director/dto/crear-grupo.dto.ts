import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class CrearGrupoDto {
  @ApiProperty({ example: 1, description: 'Grado escolar (1, 2, 3...)', required: true })
  @IsInt()
  @Min(1, { message: 'El grado debe ser al menos 1' })
  grado: number;

  @ApiProperty({ example: 'A', description: 'Nombre del grupo/sección (ej. A, B, 1)', required: true })
  @IsString()
  @MaxLength(20, { message: 'El nombre no puede superar 20 caracteres' })
  nombre: string;
}
