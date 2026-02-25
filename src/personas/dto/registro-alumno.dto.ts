/**
 * ============================================
 * DTO: RegistroAlumnoDto
 * ============================================
 * 
 * DTO para registrar un alumno.
 * Solo puede ser creado por un administrador.
 */

import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PHONE_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  GRADO_MIN,
  GRADO_MAX,
  ID_MIN,
} from '../../common/constants/validation.constants';

export class RegistroAlumnoDto {
  @ApiProperty({ example: 'Carlos', description: 'Nombre', required: true, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(NAME_MAX_LENGTH, { message: `El nombre no puede superar ${NAME_MAX_LENGTH} caracteres` })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nombre: string;

  @ApiProperty({ example: 'José', description: 'Segundo nombre (opcional)', required: false, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @IsOptional()
  @MaxLength(NAME_MAX_LENGTH, { message: `El segundo nombre no puede superar ${NAME_MAX_LENGTH} caracteres` })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  segundoNombre?: string;

  @ApiProperty({ example: 'González', description: 'Apellido paterno', required: true, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @IsNotEmpty({ message: 'El apellido paterno es obligatorio' })
  @MaxLength(NAME_MAX_LENGTH, { message: `El apellido paterno no puede superar ${NAME_MAX_LENGTH} caracteres` })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  apellidoPaterno: string;

  @ApiProperty({ example: 'Sánchez', description: 'Apellido materno', required: true, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @IsNotEmpty({ message: 'El apellido materno es obligatorio' })
  @MaxLength(NAME_MAX_LENGTH, { message: `El apellido materno no puede superar ${NAME_MAX_LENGTH} caracteres` })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  apellidoMaterno: string;

  @ApiProperty({ example: 'alumno@example.com', description: 'Email', required: true, maxLength: EMAIL_MAX_LENGTH })
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

  @ApiProperty({ example: '5555555555', description: 'Teléfono', required: false, maxLength: PHONE_MAX_LENGTH })
  @IsString()
  @IsOptional()
  @MaxLength(PHONE_MAX_LENGTH, { message: `El teléfono no puede superar ${PHONE_MAX_LENGTH} caracteres` })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  telefono?: string;

  @ApiProperty({ example: '2010-03-20', description: 'Fecha de nacimiento (YYYY-MM-DD)', required: false })
  @IsDateString({}, { message: 'La fecha de nacimiento debe ser una fecha válida (YYYY-MM-DD)' })
  @IsOptional()
  fechaNacimiento?: string;

  @ApiProperty({ example: 1, description: 'ID de la escuela. Obligatorio para admin. Opcional para director.', required: false })
  @IsOptional()
  @IsInt({ message: 'El ID de la escuela debe ser un número entero' })
  @Min(ID_MIN, { message: 'El ID de la escuela debe ser un número positivo' })
  idEscuela?: number;

  @ApiProperty({ example: 5, description: `Grado escolar (${GRADO_MIN}-${GRADO_MAX})`, required: false })
  @IsOptional()
  @IsInt({ message: 'El grado debe ser un número entero' })
  @Min(GRADO_MIN, { message: `El grado debe ser al menos ${GRADO_MIN}` })
  @Max(GRADO_MAX, { message: `El grado no puede ser mayor a ${GRADO_MAX}` })
  grado?: number;

  @ApiProperty({ example: 'A', description: 'Grupo o sección', required: false, maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20, { message: 'El grupo no puede superar 20 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  grupo?: string;

  @ApiProperty({ example: '2024-2025', description: 'Ciclo escolar', required: false, maxLength: 30 })
  @IsString()
  @IsOptional()
  @MaxLength(30, { message: 'El ciclo escolar no puede superar 30 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  cicloEscolar?: string;
}
