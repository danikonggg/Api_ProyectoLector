/**
 * ============================================
 * DTO: RegistroPadreDto
 * ============================================
 * 
 * DTO para registrar un padre/tutor.
 * Solo puede ser creado por un administrador.
 */

import { IsString, IsNotEmpty, IsEmail, IsOptional, IsDateString, IsInt, Min, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PHONE_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  ID_MIN,
} from '../../common/constants/validation.constants';

export class RegistroPadreDto {
  @ApiProperty({ example: 'María', description: 'Nombre', required: true, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(NAME_MAX_LENGTH, { message: `El nombre no puede superar ${NAME_MAX_LENGTH} caracteres` })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nombre: string;

  @ApiProperty({ example: 'López', description: 'Apellido paterno', required: true, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @IsNotEmpty({ message: 'El apellido paterno es obligatorio' })
  @MaxLength(NAME_MAX_LENGTH, { message: `El apellido paterno no puede superar ${NAME_MAX_LENGTH} caracteres` })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  apellidoPaterno: string;

  @ApiProperty({ example: 'Martínez', description: 'Apellido materno', required: true, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @IsNotEmpty({ message: 'El apellido materno es obligatorio' })
  @MaxLength(NAME_MAX_LENGTH, { message: `El apellido materno no puede superar ${NAME_MAX_LENGTH} caracteres` })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  apellidoMaterno: string;

  @ApiProperty({ example: 'padre@example.com', description: 'Email', required: true, maxLength: EMAIL_MAX_LENGTH })
  @IsEmail({}, { message: 'El correo debe tener un formato válido (ej: usuario@dominio.com)' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @MaxLength(EMAIL_MAX_LENGTH, { message: `El correo no puede superar ${EMAIL_MAX_LENGTH} caracteres` })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @ApiProperty({ example: 'password123', description: 'Contraseña (mín. 6)', minLength: PASSWORD_MIN_LENGTH, required: true })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(PASSWORD_MIN_LENGTH, { message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres` })
  password: string;

  @ApiProperty({ example: '0987654321', description: 'Teléfono', required: false, maxLength: PHONE_MAX_LENGTH })
  @IsString()
  @IsOptional()
  @MaxLength(PHONE_MAX_LENGTH, { message: `El teléfono no puede superar ${PHONE_MAX_LENGTH} caracteres` })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  telefono?: string;

  @ApiProperty({ example: '1985-05-15', description: 'Fecha de nacimiento (YYYY-MM-DD)', required: false })
  @IsDateString({}, { message: 'La fecha de nacimiento debe ser una fecha válida (YYYY-MM-DD)' })
  @IsOptional()
  fechaNacimiento?: string;

  @ApiProperty({ example: 1, description: 'ID del alumno. Si se envía, vincula al padre para ver sus avances.', required: false })
  @IsOptional()
  @IsInt({ message: 'El ID del alumno debe ser un número entero' })
  @Min(ID_MIN, { message: 'El ID del alumno debe ser un número positivo' })
  alumnoId?: number;
}
