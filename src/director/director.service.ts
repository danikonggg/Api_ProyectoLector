import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrearGrupoDto } from './dto/crear-grupo.dto';
import { ActualizarGrupoDto } from './dto/actualizar-grupo.dto';
import { AuditService } from '../audit/audit.service';
import type { AuditContext } from '../common/utils/audit.utils';

@Injectable()
export class DirectorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getDashboard(escuelaId: number) {
    const escuelaIdBig = BigInt(escuelaId);
    const escuela = await this.prisma.escuela.findUnique({
      where: { id: escuelaIdBig },
      select: { id: true, nombre: true, nivel: true, clave: true, direccion: true, telefono: true },
    });

    if (!escuela) throw new NotFoundException('No se encontró la escuela del director');

    const [totalEstudiantes, totalProfesores, librosDisponibles] = await Promise.all([
      this.prisma.alumno.count({ where: { escuelaId: escuelaIdBig } }),
      this.prisma.maestro.count({ where: { escuelaId: escuelaIdBig } }),
      this.prisma.escuelaLibro.count({ where: { escuelaId: escuelaIdBig, activo: true } }),
    ]);

    return {
      message: 'Dashboard obtenido correctamente',
      data: { escuela, totalEstudiantes, totalProfesores, librosDisponibles },
    };
  }

  async listarGrupos(escuelaId: number) {
    const escuelaIdBig = BigInt(escuelaId);
    const grupos = await this.prisma.grupo.findMany({
      where: { escuelaId: escuelaIdBig },
      orderBy: [{ grado: 'asc' }, { nombre: 'asc' }],
    });

    if (grupos.length === 0) return grupos;

    const grupoIds = grupos.map((g) => g.id);
    const asignaciones = await this.prisma.maestroGrupo.findMany({
      where: { grupoId: { in: grupoIds } },
      include: { maestro: { include: { persona: true } } },
    });

    const maestrosPorGrupo = new Map<bigint, Array<{ id: number; personaId: number; nombre: string; correo: string | null }>>();
    for (const a of asignaciones) {
      if (!a.maestro?.persona) continue;
      const p = a.maestro.persona;
      const nombre = [p.nombre, p.apellidoPaterno, p.apellidoMaterno].filter(Boolean).join(' ').trim();
      const item = { id: Number(a.maestro.id), personaId: Number(a.maestro.personaId), nombre, correo: p.correo ?? null };
      const list = maestrosPorGrupo.get(a.grupoId) ?? [];
      if (!list.find((m) => m.id === item.id)) list.push(item);
      maestrosPorGrupo.set(a.grupoId, list);
    }

    const alumnosEnGrupos = await this.prisma.alumno.findMany({
      where: { grupoId: { in: grupoIds } },
      include: { persona: true },
    });
    const nombresAlumnosPorGrupo = new Map<bigint, string[]>();
    for (const al of alumnosEnGrupos) {
      if (al.grupoId == null) continue;
      const p = al.persona;
      const nombre = [p?.nombre, p?.apellidoPaterno, p?.apellidoMaterno].filter(Boolean).join(' ').trim() || 'Sin nombre';
      const list = nombresAlumnosPorGrupo.get(al.grupoId) ?? [];
      list.push(nombre);
      nombresAlumnosPorGrupo.set(al.grupoId, list);
    }

    return grupos.map((g) => ({
      id: Number(g.id),
      escuelaId: Number(g.escuelaId),
      grado: Number(g.grado),
      nombre: g.nombre,
      activo: g.activo,
      maestros: maestrosPorGrupo.get(g.id) ?? [],
      alumnos: nombresAlumnosPorGrupo.get(g.id) ?? [],
    }));
  }

  async crearGrupo(escuelaId: number, dto: CrearGrupoDto, auditContext?: AuditContext) {
    const nombreNorm = dto.nombre.trim().toUpperCase();
    if (!nombreNorm) throw new ConflictException('El nombre del grupo no puede estar vacío');

    const escuelaIdBig = BigInt(escuelaId);
    const grupos = await this.prisma.grupo.findMany({
      where: { escuelaId: escuelaIdBig, grado: BigInt(dto.grado) },
    });
    const existente = grupos.find((g) => (g.nombre || '').trim().toUpperCase() === nombreNorm);
    if (existente) {
      throw new ConflictException(
        `Ya existe un grupo con grado ${dto.grado} y nombre "${nombreNorm}" en esta escuela`,
      );
    }

    const saved = await this.prisma.grupo.create({
      data: { escuelaId: escuelaIdBig, grado: BigInt(dto.grado), nombre: nombreNorm, activo: true },
    });

    await this.auditService.log('director_grupo_crear', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `escuelaId=${escuelaId} grupoId=${saved.id} grado=${dto.grado} nombre=${nombreNorm}`,
    });
    return saved;
  }

  async actualizarGrupo(escuelaId: number, id: number, dto: ActualizarGrupoDto, auditContext?: AuditContext) {
    const idBig = BigInt(id);
    const grupo = await this.prisma.grupo.findUnique({ where: { id: idBig } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    if (Number(grupo.escuelaId) !== escuelaId) throw new ForbiddenException('No puedes modificar un grupo de otra escuela');

    const updateData: Record<string, unknown> = {};
    if (dto.grado != null) updateData.grado = BigInt(dto.grado);
    if (dto.nombre != null) updateData.nombre = dto.nombre.trim().toUpperCase();
    if (dto.activo != null) updateData.activo = dto.activo;

    const gradoFinal = dto.grado != null ? BigInt(dto.grado) : grupo.grado;
    const nombreFinal = dto.nombre != null ? dto.nombre.trim().toUpperCase() : grupo.nombre;

    if (dto.grado != null || dto.nombre != null) {
      const gruposDelGrado = await this.prisma.grupo.findMany({
        where: { escuelaId: BigInt(escuelaId), grado: gradoFinal },
      });
      const otro = gruposDelGrado.find(
        (g) => (g.nombre || '').trim().toUpperCase() === nombreFinal && g.id !== idBig,
      );
      if (otro) throw new ConflictException(`Ya existe un grupo con grado ${gradoFinal} y nombre "${nombreFinal}"`);
    }

    const saved = await this.prisma.grupo.update({ where: { id: idBig }, data: updateData });

    if (dto.maestroIds != null) {
      const maestroIdsUnicos = [...new Set(dto.maestroIds)];
      for (const maestroId of maestroIdsUnicos) {
        const maestro = await this.prisma.maestro.findUnique({ where: { id: BigInt(maestroId) } });
        if (!maestro) throw new NotFoundException(`Maestro con ID ${maestroId} no encontrado`);
        if (Number(maestro.escuelaId) !== escuelaId) throw new ForbiddenException(`El maestro ${maestroId} no pertenece a tu escuela`);
      }
      await this.prisma.maestroGrupo.deleteMany({ where: { grupoId: idBig } });
      for (const maestroId of maestroIdsUnicos) {
        await this.prisma.maestroGrupo.upsert({
          where: { maestroId_grupoId: { maestroId: BigInt(maestroId), grupoId: idBig } },
          update: {},
          create: { maestroId: BigInt(maestroId), grupoId: idBig },
        });
        await this.auditService.log('director_maestro_asignar_grupo', {
          usuarioId: auditContext?.usuarioId ?? null,
          ip: auditContext?.ip ?? null,
          detalles: `escuelaId=${escuelaId} maestroId=${maestroId} grupoId=${id}`,
        });
      }
    }

    if (dto.alumnoIds != null) {
      const alumnoIdsUnicos = [...new Set(dto.alumnoIds)];
      for (const alumnoId of alumnoIdsUnicos) {
        const alumno = await this.prisma.alumno.findUnique({ where: { id: BigInt(alumnoId) } });
        if (!alumno) throw new NotFoundException(`Alumno con ID ${alumnoId} no encontrado`);
        if (Number(alumno.escuelaId) !== escuelaId) throw new ForbiddenException(`El alumno ${alumnoId} no pertenece a tu escuela`);
      }
      await this.prisma.alumno.updateMany({
        where: { grupoId: idBig, id: { notIn: alumnoIdsUnicos.map((a) => BigInt(a)) } },
        data: { grupoId: null, grupo: null },
      });
      for (const alumnoId of alumnoIdsUnicos) {
        await this.prisma.alumno.update({
          where: { id: BigInt(alumnoId) },
          data: { grupoId: idBig, grado: saved.grado, grupo: saved.nombre },
        });
        await this.auditService.log('director_alumno_cambiar_grupo', {
          usuarioId: auditContext?.usuarioId ?? null,
          ip: auditContext?.ip ?? null,
          detalles: `escuelaId=${escuelaId} alumnoId=${alumnoId} grupoId=${id} (vía PATCH grupo)`,
        });
      }
    }

    await this.auditService.log('director_grupo_actualizar', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `escuelaId=${escuelaId} grupoId=${id} grado=${saved.grado} nombre=${saved.nombre}`,
    });

    const asignaciones = await this.prisma.maestroGrupo.findMany({
      where: { grupoId: idBig },
      include: { maestro: { include: { persona: true } } },
    });
    const maestros = asignaciones
      .filter((a) => a.maestro?.persona)
      .map((a) => {
        const p = a.maestro!.persona!;
        return {
          id: Number(a.maestro!.id),
          personaId: Number(a.maestro!.personaId),
          nombre: [p.nombre, p.apellidoPaterno, p.apellidoMaterno].filter(Boolean).join(' ').trim(),
          correo: p.correo ?? null,
        };
      });

    return { id: Number(saved.id), escuelaId: Number(saved.escuelaId), grado: Number(saved.grado), nombre: saved.nombre, activo: saved.activo, maestros };
  }

  async eliminarGrupo(escuelaId: number, id: number, auditContext?: AuditContext) {
    const idBig = BigInt(id);
    const grupo = await this.prisma.grupo.findUnique({ where: { id: idBig } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    if (Number(grupo.escuelaId) !== escuelaId) throw new ForbiddenException('No puedes eliminar un grupo de otra escuela');

    await this.prisma.grupo.delete({ where: { id: idBig } });
    await this.auditService.log('director_grupo_eliminar', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `escuelaId=${escuelaId} grupoId=${id} grado=${grupo.grado} nombre=${grupo.nombre}`,
    });
    return { message: 'Grupo eliminado correctamente' };
  }

  async asignarGrupoAMaestro(escuelaId: number, maestroId: number, grupoId: number, auditContext?: AuditContext) {
    const maestro = await this.prisma.maestro.findUnique({ where: { id: BigInt(maestroId) } });
    if (!maestro) throw new NotFoundException('Maestro no encontrado');
    if (Number(maestro.escuelaId) !== escuelaId) throw new ForbiddenException('No puedes asignar grupos a maestros de otra escuela');

    const grupo = await this.prisma.grupo.findUnique({ where: { id: BigInt(grupoId) } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    if (Number(grupo.escuelaId) !== escuelaId) throw new ForbiddenException('El grupo no pertenece a tu escuela');

    const existente = await this.prisma.maestroGrupo.findFirst({
      where: { maestroId: BigInt(maestroId), grupoId: BigInt(grupoId) },
    });
    if (existente) throw new ConflictException('El maestro ya tiene asignado este grupo');

    const saved = await this.prisma.maestroGrupo.create({
      data: { maestroId: BigInt(maestroId), grupoId: BigInt(grupoId) },
    });
    await this.auditService.log('director_maestro_asignar_grupo', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `escuelaId=${escuelaId} maestroId=${maestroId} grupoId=${grupoId}`,
    });
    return saved;
  }

  async desasignarGrupoDeMaestro(escuelaId: number, maestroId: number, grupoId: number, auditContext?: AuditContext) {
    const maestro = await this.prisma.maestro.findUnique({ where: { id: BigInt(maestroId) } });
    if (!maestro) throw new NotFoundException('Maestro no encontrado');
    if (Number(maestro.escuelaId) !== escuelaId) throw new ForbiddenException('No puedes desasignar grupos de maestros de otra escuela');

    const asignacion = await this.prisma.maestroGrupo.findFirst({
      where: { maestroId: BigInt(maestroId), grupoId: BigInt(grupoId) },
    });
    if (!asignacion) throw new NotFoundException('El maestro no tiene asignado este grupo');

    await this.prisma.maestroGrupo.delete({ where: { id: asignacion.id } });
    await this.auditService.log('director_maestro_desasignar_grupo', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `escuelaId=${escuelaId} maestroId=${maestroId} grupoId=${grupoId}`,
    });
    return { message: 'Grupo desasignado del maestro correctamente' };
  }

  async actualizarGrupoDeAlumno(escuelaId: number, alumnoId: number, dto: { grupoId?: number | null }, auditContext?: AuditContext) {
    const alumno = await this.prisma.alumno.findUnique({
      where: { id: BigInt(alumnoId) },
      include: { persona: true },
    });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    if (Number(alumno.escuelaId) !== escuelaId) throw new ForbiddenException('No puedes modificar alumnos de otra escuela');

    let updateData: Record<string, unknown> = { grupoId: null, grupo: null };
    if (dto.grupoId != null) {
      const grupo = await this.prisma.grupo.findUnique({ where: { id: BigInt(dto.grupoId) } });
      if (!grupo) throw new NotFoundException('Grupo no encontrado');
      if (Number(grupo.escuelaId) !== escuelaId) throw new ForbiddenException('El grupo no pertenece a tu escuela');
      updateData = { grupoId: grupo.id, grado: grupo.grado, grupo: grupo.nombre };
    }

    const updated = await this.prisma.alumno.update({ where: { id: BigInt(alumnoId) }, data: updateData });
    await this.auditService.log('director_alumno_cambiar_grupo', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `escuelaId=${escuelaId} alumnoId=${alumnoId} nuevoGrupoId=${dto.grupoId ?? 'null'}`,
    });

    return {
      message: 'Grupo del alumno actualizado correctamente',
      alumno: {
        id: Number(updated.id),
        personaId: Number(updated.personaId),
        escuelaId: Number(updated.escuelaId),
        grado: Number(updated.grado),
        grupo: updated.grupo,
        grupoId: updated.grupoId != null ? Number(updated.grupoId) : null,
      },
    };
  }

  async listarGruposDeMaestro(escuelaId: number, maestroId: number) {
    const maestro = await this.prisma.maestro.findUnique({ where: { id: BigInt(maestroId) } });
    if (!maestro) throw new NotFoundException('Maestro no encontrado');
    if (Number(maestro.escuelaId) !== escuelaId) throw new ForbiddenException('No puedes ver grupos de maestros de otra escuela');

    const asignaciones = await this.prisma.maestroGrupo.findMany({
      where: { maestroId: BigInt(maestroId) },
      include: { grupo: true },
    });
    const grupos = asignaciones.map((a) => a.grupo).filter(Boolean);
    grupos.sort((a, b) => {
      const diff = Number(a.grado) - Number(b.grado);
      return diff !== 0 ? diff : String(a.nombre).localeCompare(String(b.nombre));
    });
    return grupos;
  }
}
