import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { EMAIL_MAX_LENGTH } from '../../common/constants/validation.constants';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Correo electrónico de la cuenta',
    example: 'usuario@example.com',
    maxLength: EMAIL_MAX_LENGTH,
  })
  @IsEmail({}, { message: 'El correo debe tener un formato válido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @MaxLength(EMAIL_MAX_LENGTH, {
    message: `El correo no puede superar ${EMAIL_MAX_LENGTH} caracteres`,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;
}
