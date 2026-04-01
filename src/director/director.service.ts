import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Escuela } from '../personas/entities/escuela.entity';
import { Alumno } from '../personas/entities/alumno.entity';
import { Maestro } from '../personas/entities/maestro.entity';
import { EscuelaLibro } from '../escuelas/entities/escuela-libro.entity';
import { Grupo } from '../escuelas/entities/grupo.entity';
import { MaestroGrupo } from '../escuelas/entities/maestro-grupo.entity';
import { CrearGrupoDto } from './dto/crear-grupo.dto';
import { ActualizarGrupoDto } from './dto/actualizar-grupo.dto';
import { AuditService } from '../audit/audit.service';
import type { AuditContext } from '../common/utils/audit.utils';

@Injectable()
export class DirectorService {
  constructor(
    @InjectRepository(Escuela)
    private readonly escuelaRepository: Repository<Escuela>,
    @InjectRepository(Alumno)
    private readonly alumnoRepository: Repository<Alumno>,
    @InjectRepository(Maestro)
    private readonly maestroRepository: Repository<Maestro>,
    @InjectRepository(EscuelaLibro)
    private readonly escuelaLibroRepository: Repository<EscuelaLibro>,
    @InjectRepository(Grupo)
    private readonly grupoRepository: Repository<Grupo>,
    @InjectRepository(MaestroGrupo)
    private readonly maestroGrupoRepository: Repository<MaestroGrupo>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Obtener dashboard del director con datos de su escuela.
   */
  async getDashboard(escuelaId: number) {
    const escuela = await this.escuelaRepository.findOne({
      where: { id: escuelaId },
      select: ['id', 'nombre', 'nivel', 'clave', 'direccion', 'telefono'],
    });

    if (!escuela) {
      throw new NotFoundException('No se encontró la escuela del director');
    }

    const [totalEstudiantes, totalProfesores, librosDisponibles] =
      await Promise.all([
        this.alumnoRepository.count({ where: { escuelaId } }),
        this.maestroRepository.count({ where: { escuelaId } }),
        this.escuelaLibroRepository.count({
          where: { escuelaId, activo: true },
        }),
      ]);

    return {
      message: 'Dashboard obtenido correctamente',
      data: {
        escuela: {
          id: escuela.id,
          nombre: escuela.nombre,
          nivel: escuela.nivel,
          clave: escuela.clave,
          direccion: escuela.direccion,
          telefono: escuela.telefono,
        },
        totalEstudiantes,
        totalProfesores,
        librosDisponibles,
      },
    };
  }

  /**
   * Listar grupos de la escuela del director con maestros asignados.
   */
  async listarGrupos(escuelaId: number) {
    const grupos = await this.grupoRepository.find({
      where: { escuelaId },
      order: { grado: 'ASC', nombre: 'ASC' },
    });

    if (grupos.length === 0) {
      return grupos;
    }

    const grupoIds = grupos.map((g) => g.id);
    const asignaciones = await this.maestroGrupoRepository.find({
      where: { grupoId: In(grupoIds) },
      relations: ['maestro', 'maestro.persona'],
    });

    const maestrosPorGrupo = new Map<number, Array<{ id: number; personaId: number; nombre: string; correo: string | null }>>();
    for (const a of asignaciones) {
      if (!a.maestro?.persona) continue;
      const p = a.maestro.persona;
      const nombre = [p.nombre, p.apellidoPaterno, p.apellidoMaterno].filter(Boolean).join(' ').trim();
      const item = {
        id: a.maestro.id,
        personaId: a.maestro.personaId,
        nombre,
        correo: p.correo ?? null,
      };
      const list = maestrosPorGrupo.get(a.grupoId) ?? [];
      if (!list.find((m) => m.id === item.id)) list.push(item);
      maestrosPorGrupo.set(a.grupoId, list);
    }

    const alumnosEnGrupos = await this.alumnoRepository.find({
      where: { grupoId: In(grupoIds) },
      relations: ['persona'],
    });
    const nombresAlumnosPorGrupo = new Map<number, string[]>();
    for (const al of alumnosEnGrupos) {
      if (al.grupoId == null) continue;
      const p = al.persona;
      const nombre = [p?.nombre, p?.apellidoPaterno, p?.apellidoMaterno].filter(Boolean).join(' ').trim() || 'Sin nombre';
      const list = nombresAlumnosPorGrupo.get(al.grupoId) ?? [];
      list.push(nombre);
      nombresAlumnosPorGrupo.set(al.grupoId, list);
    }

    return grupos.map((g) => ({
      id: g.id,
      escuelaId: g.escuelaId,
      grado: g.grado,
      nombre: g.nombre,
      activo: g.activo,
      maestros: maestrosPorGrupo.get(g.id) ?? [],
      alumnos: nombresAlumnosPorGrupo.get(g.id) ?? [],
    }));
  }

  /**
   * Crear grupo en la escuela del director.
   */
  async crearGrupo(escuelaId: number, dto: CrearGrupoDto, auditContext?: AuditContext) {
    const nombreNorm = dto.nombre.trim().toUpperCase();
    if (!nombreNorm) {
      throw new ConflictException('El nombre del grupo no puede estar vacío');
    }
    const grupos = await this.grupoRepository.find({ where: { escuelaId, grado: dto.grado } });
    const existente = grupos.find((g) => (g.nombre || '').trim().toUpperCase() === nombreNorm);
    if (existente) {
      throw new ConflictException(
        `Ya existe un grupo con grado ${dto.grado} y nombre "${nombreNorm}" en esta escuela`,
      );
    }

    const grupo = this.grupoRepository.create({
      escuelaId,
      grado: dto.grado,
      nombre: nombreNorm,
      activo: true,
    });
    const saved = await this.grupoRepository.save(grupo);
    await this.auditService.log('director_grupo_crear', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `escuelaId=${escuelaId} grupoId=${saved.id} grado=${dto.grado} nombre=${nombreNorm}`,
    });
    return saved;
  }

  /**
   * Actualizar grupo. Solo si pertenece a la escuela del director.
   */
  async actualizarGrupo(escuelaId: number, id: number, dto: ActualizarGrupoDto, auditContext?: AuditContext) {
    const grupo = await this.grupoRepository.findOne({ where: { id } });
    if (!grupo) {
      throw new NotFoundException('Grupo no encontrado');
    }
    if (Number(grupo.escuelaId) !== Number(escuelaId)) {
      throw new ForbiddenException('No puedes modificar un grupo de otra escuela');
    }

    if (dto.grado != null) grupo.grado = dto.grado;
    if (dto.nombre != null) grupo.nombre = dto.nombre.trim().toUpperCase();
    if (dto.activo != null) grupo.activo = dto.activo;

    if (dto.grado != null || dto.nombre != null) {
      const gruposDelGrado = await this.grupoRepository.find({
        where: { escuelaId, grado: grupo.grado },
      });
      const nombreNorm = (grupo.nombre || '').trim().toUpperCase();
      const otro = gruposDelGrado.find((g) => (g.nombre || '').trim().toUpperCase() === nombreNorm && g.id !== grupo.id);
      if (otro) {
        throw new ConflictException(
          `Ya existe un grupo con grado ${grupo.grado} y nombre "${grupo.nombre}" en esta escuela`,
        );
      }
    }

    const saved = await this.grupoRepository.save(grupo);

    if (dto.maestroIds != null) {
      const maestroIdsUnicos = [...new Set(dto.maestroIds)];
      for (const maestroId of maestroIdsUnicos) {
        const maestro = await this.maestroRepository.findOne({ where: { id: maestroId } });
        if (!maestro) {
          throw new NotFoundException(`Maestro con ID ${maestroId} no encontrado`);
        }
        if (Number(maestro.escuelaId) !== Number(escuelaId)) {
          throw new ForbiddenException(`El maestro ${maestroId} no pertenece a tu escuela`);
        }
      }
      const existentes = await this.maestroGrupoRepository.find({ where: { grupoId: id } });
      await this.maestroGrupoRepository.remove(existentes);
      for (const maestroId of maestroIdsUnicos) {
        const yaExiste = await this.maestroGrupoRepository.findOne({ where: { maestroId, grupoId: id } });
        if (!yaExiste) {
          const mg = this.maestroGrupoRepository.create({ maestroId, grupoId: id });
          await this.maestroGrupoRepository.save(mg);
          await this.auditService.log('director_maestro_asignar_grupo', {
            usuarioId: auditContext?.usuarioId ?? null,
            ip: auditContext?.ip ?? null,
            detalles: `escuelaId=${escuelaId} maestroId=${maestroId} grupoId=${id}`,
          });
        }
      }
    }

    if (dto.alumnoIds != null) {
      const alumnoIdsUnicos = [...new Set(dto.alumnoIds)];
      for (const alumnoId of alumnoIdsUnicos) {
        const alumno = await this.alumnoRepository.findOne({ where: { id: alumnoId } });
        if (!alumno) {
          throw new NotFoundException(`Alumno con ID ${alumnoId} no encontrado`);
        }
        if (Number(alumno.escuelaId) !== Number(escuelaId)) {
          throw new ForbiddenException(`El alumno ${alumnoId} no pertenece a tu escuela`);
        }
      }
      const alumnosEnEsteGrupo = await this.alumnoRepository.find({ where: { grupoId: id } });
      for (const a of alumnosEnEsteGrupo) {
        if (!alumnoIdsUnicos.includes(a.id)) {
          a.grupoId = null;
          a.grupo = null;
          await this.alumnoRepository.save(a);
        }
      }
      for (const alumnoId of alumnoIdsUnicos) {
        const alumno = await this.alumnoRepository.findOne({ where: { id: alumnoId } });
        if (!alumno) continue;
        if (alumno.grupoId !== id) {
          alumno.grupoId = id;
          alumno.grado = Number(saved.grado);
          alumno.grupo = saved.nombre;
          await this.alumnoRepository.save(alumno);
          await this.auditService.log('director_alumno_cambiar_grupo', {
            usuarioId: auditContext?.usuarioId ?? null,
            ip: auditContext?.ip ?? null,
            detalles: `escuelaId=${escuelaId} alumnoId=${alumnoId} grupoId=${id} (vía PATCH grupo)`,
          });
        }
      }
    }

    await this.auditService.log('director_grupo_actualizar', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `escuelaId=${escuelaId} grupoId=${id} grado=${grupo.grado} nombre=${grupo.nombre}`,
    });

    const asignaciones = await this.maestroGrupoRepository.find({
      where: { grupoId: id },
      relations: ['maestro', 'maestro.persona'],
    });
    const maestros = asignaciones
      .filter((a) => a.maestro?.persona)
      .map((a) => {
        const p = a.maestro!.persona!;
        const nombre = [p.nombre, p.apellidoPaterno, p.apellidoMaterno].filter(Boolean).join(' ').trim();
        return {
          id: a.maestro!.id,
          personaId: a.maestro!.personaId,
          nombre,
          correo: p.correo ?? null,
        };
      });

    return {
      id: saved.id,
      escuelaId: saved.escuelaId,
      grado: saved.grado,
      nombre: saved.nombre,
      activo: saved.activo,
      maestros,
    };
  }

  /**
   * Eliminar grupo. Solo si pertenece a la escuela del director.
   */
  async eliminarGrupo(escuelaId: number, id: number, auditContext?: AuditContext) {
    const grupo = await this.grupoRepository.findOne({ where: { id } });
    if (!grupo) {
      throw new NotFoundException('Grupo no encontrado');
    }
    if (Number(grupo.escuelaId) !== Number(escuelaId)) {
      throw new ForbiddenException('No puedes eliminar un grupo de otra escuela');
    }
    await this.grupoRepository.remove(grupo);
    await this.auditService.log('director_grupo_eliminar', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `escuelaId=${escuelaId} grupoId=${id} grado=${grupo.grado} nombre=${grupo.nombre}`,
    });
    return { message: 'Grupo eliminado correctamente' };
  }

  /**
   * Asignar grupo a maestro. Director solo puede asignar en su escuela.
   */
  async asignarGrupoAMaestro(escuelaId: number, maestroId: number, grupoId: number, auditContext?: AuditContext) {
    const maestro = await this.maestroRepository.findOne({ where: { id: maestroId } });
    if (!maestro) throw new NotFoundException('Maestro no encontrado');
    if (Number(maestro.escuelaId) !== Number(escuelaId)) {
      throw new ForbiddenException('No puedes asignar grupos a maestros de otra escuela');
    }

    const grupo = await this.grupoRepository.findOne({ where: { id: grupoId } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    if (Number(grupo.escuelaId) !== Number(escuelaId)) {
      throw new ForbiddenException('El grupo no pertenece a tu escuela');
    }

    const existente = await this.maestroGrupoRepository.findOne({
      where: { maestroId, grupoId },
    });
    if (existente) {
      throw new ConflictException('El maestro ya tiene asignado este grupo');
    }

    const mg = this.maestroGrupoRepository.create({ maestroId, grupoId });
    const saved = await this.maestroGrupoRepository.save(mg);
    await this.auditService.log('director_maestro_asignar_grupo', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `escuelaId=${escuelaId} maestroId=${maestroId} grupoId=${grupoId}`,
    });
    return saved;
  }

  /**
   * Desasignar grupo de maestro.
   */
  async desasignarGrupoDeMaestro(escuelaId: number, maestroId: number, grupoId: number, auditContext?: AuditContext) {
    const maestro = await this.maestroRepository.findOne({ where: { id: maestroId } });
    if (!maestro) throw new NotFoundException('Maestro no encontrado');
    if (Number(maestro.escuelaId) !== Number(escuelaId)) {
      throw new ForbiddenException('No puedes desasignar grupos de maestros de otra escuela');
    }

    const asignacion = await this.maestroGrupoRepository.findOne({
      where: { maestroId, grupoId },
    });
    if (!asignacion) throw new NotFoundException('El maestro no tiene asignado este grupo');

    await this.maestroGrupoRepository.remove(asignacion);
    await this.auditService.log('director_maestro_desasignar_grupo', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `escuelaId=${escuelaId} maestroId=${maestroId} grupoId=${grupoId}`,
    });
    return { message: 'Grupo desasignado del maestro correctamente' };
  }

  /**
   * Actualizar grupo de un alumno. Director solo puede en su escuela.
   */
  async actualizarGrupoDeAlumno(
    escuelaId: number,
    alumnoId: number,
    dto: { grupoId?: number | null },
    auditContext?: AuditContext,
  ) {
    const alumno = await this.alumnoRepository.findOne({ where: { id: alumnoId }, relations: ['persona'] });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    if (Number(alumno.escuelaId) !== Number(escuelaId)) {
      throw new ForbiddenException('No puedes modificar alumnos de otra escuela');
    }

    if (dto.grupoId == null || dto.grupoId === undefined) {
      alumno.grupoId = null;
      alumno.grupo = null;
    } else {
      const grupo = await this.grupoRepository.findOne({ where: { id: dto.grupoId } });
      if (!grupo) throw new NotFoundException('Grupo no encontrado');
      if (Number(grupo.escuelaId) !== Number(escuelaId)) {
        throw new ForbiddenException('El grupo no pertenece a tu escuela');
      }
      alumno.grupoId = grupo.id;
      alumno.grado = Number(grupo.grado);
      alumno.grupo = grupo.nombre;
    }

    await this.alumnoRepository.save(alumno);
    await this.auditService.log('director_alumno_cambiar_grupo', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `escuelaId=${escuelaId} alumnoId=${alumnoId} nuevoGrupoId=${dto.grupoId ?? 'null'}`,
    });
    return {
      message: 'Grupo del alumno actualizado correctamente',
      alumno: {
        id: alumno.id,
        personaId: alumno.personaId,
        escuelaId: alumno.escuelaId,
        grado: alumno.grado,
        grupo: alumno.grupo,
        grupoId: alumno.grupoId,
      },
    };
  }

  /**
   * Listar grupos asignados a un maestro.
   */
  async listarGruposDeMaestro(escuelaId: number, maestroId: number) {
    const maestro = await this.maestroRepository.findOne({ where: { id: maestroId } });
    if (!maestro) throw new NotFoundException('Maestro no encontrado');
    if (Number(maestro.escuelaId) !== Number(escuelaId)) {
      throw new ForbiddenException('No puedes ver grupos de maestros de otra escuela');
    }

    const asignaciones = await this.maestroGrupoRepository.find({
      where: { maestroId },
      relations: ['grupo'],
    });
    const grupos = asignaciones.map((a) => a.grupo).filter(Boolean);
    grupos.sort((a, b) => {
      const diff = Number(a.grado) - Number(b.grado);
      return diff !== 0 ? diff : String(a.nombre).localeCompare(String(b.nombre));
    });
    return grupos;
  }
}
