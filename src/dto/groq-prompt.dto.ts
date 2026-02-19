import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/** Límite razonable para el prompt (evitar payloads enormes) */
const PROMPT_MAX_LENGTH = 8000;

export class GroqPromptDto {
  @ApiProperty({
    description: 'Texto que quieres enviar a Groq. Lo que escribas aquí se manda tal cual.',
    example: '¿Cuánto es 2+2? Responde solo con el número.',
    required: false,
    maxLength: PROMPT_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(PROMPT_MAX_LENGTH, { message: `El prompt no puede superar ${PROMPT_MAX_LENGTH} caracteres` })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  prompt?: string;
}
