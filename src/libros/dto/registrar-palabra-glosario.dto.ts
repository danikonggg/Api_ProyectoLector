import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { GLOSSARY_WORD_MAX_LENGTH } from '../../common/constants/validation.constants';

/** Body mínimo: solo la palabra a buscar y guardar en el glosario global. */
export class RegistrarPalabraGlosarioDto {
  @ApiProperty({
    example: 'metáfora',
    description:
      'Término a normalizar y registrar (búsqueda automática en fuentes web + IA si aplica).',
    maxLength: GLOSSARY_WORD_MAX_LENGTH,
  })
  @IsString()
  @MinLength(2, { message: 'La palabra debe tener al menos 2 caracteres' })
  @MaxLength(GLOSSARY_WORD_MAX_LENGTH, {
    message: `La palabra no puede superar ${GLOSSARY_WORD_MAX_LENGTH} caracteres`,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  palabra: string;
}
