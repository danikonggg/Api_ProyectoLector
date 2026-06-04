import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the escuelaId the current user is allowed to operate on.
   * - Admin: can operate on any school (returns the requested id as-is)
   * - Director: restricted to their own school
   * - Throws ForbiddenException if a director tries to access another school
   */
  resolveEscuelaId(user: RequestUser, requestedEscuelaId?: number): number {
    if (user.tipoPersona === 'administrador') {
      if (requestedEscuelaId == null) {
        throw new ForbiddenException('Debes especificar una escuela');
      }
      return requestedEscuelaId;
    }

    if (user.tipoPersona === 'director') {
      const directorEscuelaId = user.director?.escuelaId;
      if (!directorEscuelaId) {
        throw new ForbiddenException('Director sin escuela asignada');
      }
      if (requestedEscuelaId != null && requestedEscuelaId !== directorEscuelaId) {
        throw new ForbiddenException('No tienes permiso para acceder a esta escuela');
      }
      return directorEscuelaId;
    }

    throw new ForbiddenException('No autorizado');
  }

  /**
   * Asserts that an alumno belongs to the school the user can manage.
   * Throws ForbiddenException for directors accessing other-school students.
   */
  async assertAlumnoBelongsToUserSchool(
    user: RequestUser,
    alumnoId: number,
  ): Promise<void> {
    if (user.tipoPersona === 'administrador') return;

    const escuelaId = this.resolveEscuelaId(user);

    const alumno = await this.prisma.alumno.findUnique({
      where: { id: BigInt(alumnoId) },
      select: { escuelaId: true },
    });

    if (!alumno) {
      throw new NotFoundException('Alumno no encontrado');
    }

    if (Number(alumno.escuelaId) !== escuelaId) {
      throw new ForbiddenException('No tienes permiso para acceder a este alumno');
    }
  }

  /**
   * Asserts that a maestro belongs to the school the user can manage.
   */
  async assertMaestroBelongsToUserSchool(
    user: RequestUser,
    maestroId: number,
  ): Promise<void> {
    if (user.tipoPersona === 'administrador') return;

    const escuelaId = this.resolveEscuelaId(user);

    const maestro = await this.prisma.maestro.findUnique({
      where: { id: BigInt(maestroId) },
      select: { escuelaId: true },
    });

    if (!maestro) {
      throw new NotFoundException('Maestro no encontrado');
    }

    if (Number(maestro.escuelaId) !== escuelaId) {
      throw new ForbiddenException('No tienes permiso para acceder a este maestro');
    }
  }

  /**
   * Asserts that the authenticated padre is accessing their own resource
   * or that the caller is an admin.
   */
  assertPadreOwnership(user: RequestUser, padreId: number): void {
    if (user.tipoPersona === 'administrador') return;

    if (user.tipoPersona === 'padre' && user.padre?.id === padreId) return;

    throw new ForbiddenException('No tienes permiso para acceder a este recurso');
  }
}
