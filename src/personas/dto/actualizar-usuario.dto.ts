/**
 * DTO para actualizar un usuario (cualquier rol) por parte del administrador.
 * No permite cambiar el rol (tipoPersona). Todos los campos son opcionales.
 */

import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsDateString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EMAIL_MAX_LENGTH, NAME_MAX_LENGTH, PHONE_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../common/constants/validation.constants';

export class ActualizarUsuarioDto {
  @ApiPropertyOptional({ example: 'Juan', description: 'Nombre', maxLength: NAME_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX_LENGTH, { message: `El nombre no puede superar ${NAME_MAX_LENGTH} caracteres` })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nombre?: string;

  @ApiPropertyOptional({ example: 'Carlos', description: 'Segundo nombre', maxLength: NAME_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX_LENGTH, { message: `El segundo nombre no puede superar ${NAME_MAX_LENGTH} caracteres` })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  segundoNombre?: string;

  @ApiPropertyOptional({ example: 'Pérez', description: 'Apellido paterno', maxLength: NAME_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX_LENGTH, { message: `El apellido paterno no puede superar ${NAME_MAX_LENGTH} caracteres` })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  apellidoPaterno?: string;

  @ApiPropertyOptional({ example: 'García', description: 'Apellido materno', maxLength: NAME_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX_LENGTH, { message: `El apellido materno no puede superar ${NAME_MAX_LENGTH} caracteres` })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  apellidoMaterno?: string;

  /** @deprecated Usar apellidoPaterno. Se mantiene por compatibilidad. */
  @IsOptional()
  apellido?: string;

  @ApiPropertyOptional({ example: 'juan@example.com', description: 'Correo electrónico', maxLength: EMAIL_MAX_LENGTH })
  @IsOptional()
  @IsEmail({}, { message: 'El correo debe tener un formato válido (ej: usuario@dominio.com)' })
  @MaxLength(EMAIL_MAX_LENGTH, { message: `El correo no puede superar ${EMAIL_MAX_LENGTH} caracteres` })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  correo?: string;

  @ApiPropertyOptional({ example: '5551234567', description: 'Teléfono', maxLength: PHONE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(PHONE_MAX_LENGTH, { message: `El teléfono no puede superar ${PHONE_MAX_LENGTH} caracteres` })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  telefono?: string;

  @ApiPropertyOptional({ example: '1990-05-15', description: 'Fecha de nacimiento (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de nacimiento debe ser una fecha válida (YYYY-MM-DD)' })
  fechaNacimiento?: string;

  @ApiPropertyOptional({ example: 'M', description: 'Género', maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'El género no puede superar 30 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  genero?: string;

  @ApiPropertyOptional({ example: 'nuevaPassword123', description: 'Nueva contraseña (mín. 6). Si no se envía o se envía vacío, se mantiene la actual.' })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres` })
  password?: string;

  @ApiPropertyOptional({ example: true, description: 'Usuario activo o no' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
