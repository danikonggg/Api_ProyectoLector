import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class AsignarGrupoMaestroDto {
  @ApiProperty({ example: 1, description: 'ID del maestro' })
  @IsInt()
  @IsPositive()
  maestroId: number;

  @ApiProperty({ example: 2, description: 'ID del grupo' })
  @IsInt()
  @IsPositive()
  grupoId: number;
}
