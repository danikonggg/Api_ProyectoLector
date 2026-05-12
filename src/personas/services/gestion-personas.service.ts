import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { ActualizarUsuarioDto } from '../dto/actualizar-usuario.dto';
import { AuditService } from '../../audit/audit.service';
import { JwtPersonaLoaderService } from '../../auth/services/jwt-persona-loader.service';
import { ConsultaPersonasService } from './consulta-personas.service';

export interface AuditContext {
  usuarioId?: number | null;
  ip?: string | null;
}

@Injectable()
export class GestionPersonasService {
  private readonly logger = new Logger(GestionPersonasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly jwtPersonaLoader: JwtPersonaLoaderService,
    private readonly consultaPersonasService: ConsultaPersonasService,
  ) {}

  async actualizarUsuarioPorId(id: number, dto: ActualizarUsuarioDto, auditContext?: AuditContext) {
    const persona = await this.prisma.persona.findUnique({
      where: { id: BigInt(id) },
      include: { administrador: true, director: true, maestro: true, alumno: true, padre: true },
    });

    if (!persona) throw new NotFoundException(`Usuario con ID ${id} no encontrado`);

    if (dto.correo != null && dto.correo.trim() !== '') {
      const correoObj = dto.correo.trim();
      if (correoObj !== persona.correo) {
        const otro = await this.prisma.persona.findFirst({
          where: { correo: correoObj },
          select: { id: true },
        });
        if (otro) throw new ConflictException('El correo ya está en uso por otro usuario');
      }
    }

    const data: Record<string, any> = {};
    if (dto.nombre != null) data.nombre = dto.nombre.trim();
    if (dto.apellidoPaterno != null) data.apellidoPaterno = dto.apellidoPaterno.trim();
    if (dto.apellidoMaterno != null) data.apellidoMaterno = dto.apellidoMaterno.trim() || null;
    if (dto.apellido != null) data.apellidoPaterno = dto.apellido.trim();
    if (dto.correo != null) data.correo = dto.correo.trim() || null;
    if (dto.telefono != null) data.telefono = dto.telefono.trim() || null;
    if (dto.fechaNacimiento != null) data.fechaNacimiento = new Date(dto.fechaNacimiento);
    if (dto.genero != null) data.genero = dto.genero.trim() || null;
    if (dto.activo != null) data.activo = dto.activo;

    if (dto.password != null && dto.password.trim() !== '') {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    await this.prisma.persona.update({ where: { id: BigInt(id) }, data });
    await this.jwtPersonaLoader.invalidate(id);

    await this.auditService.log('actualizar_usuario', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `personaId: ${id} | ${data.correo ?? persona.correo ?? ''}`,
    });

    const resultado = await this.prisma.persona.findUnique({
      where: { id: BigInt(id) },
      include: {
        administrador: true,
        director: { include: { escuela: true } },
        maestro: { include: { escuela: true } },
        alumno: { include: { escuela: true } },
        padre: true,
      },
    });

    const resultadoSinPassword = { ...(resultado as any) };
    delete resultadoSinPassword.password;

    return { message: 'Usuario actualizado correctamente', data: resultadoSinPassword };
  }

  async actualizarAlumno(
    alumnoId: number,
    dto: ActualizarUsuarioDto,
    escuelaIdRestriccion: number | undefined,
    auditContext?: AuditContext,
  ) {
    const { data: alumnoData } = await this.consultaPersonasService.obtenerAlumnoPorId(
      alumnoId,
      escuelaIdRestriccion,
    );
    const { grupoId, ...dtoPersona } = dto;

    const resultado = await this.actualizarUsuarioPorId(
      alumnoData.personaId,
      dtoPersona as ActualizarUsuarioDto,
      auditContext,
    );

    if (grupoId !== undefined) {
      const alumno = await this.prisma.alumno.findUnique({
        where: { id: BigInt(alumnoId) },
        include: { persona: true },
      });
      if (!alumno) return resultado;
      const escuelaId = Number(alumno.escuelaId);
      if (escuelaIdRestriccion != null && Number(escuelaIdRestriccion) !== escuelaId)
        throw new ForbiddenException('No puedes modificar alumnos de otra escuela');

      if (grupoId == null) {
        await this.prisma.alumno.update({
          where: { id: alumno.id },
          data: { grupoId: null, grupo: null },
        });
      } else {
        const grupo = await this.prisma.grupo.findUnique({ where: { id: BigInt(grupoId) } });
        if (!grupo) throw new NotFoundException('Grupo no encontrado');
        if (Number(grupo.escuelaId) !== escuelaId)
          throw new ForbiddenException('El grupo no pertenece a la escuela del alumno');
        await this.prisma.alumno.update({
          where: { id: alumno.id },
          data: { grupoId: grupo.id, grado: grupo.grado, grupo: grupo.nombre },
        });
      }

      await this.auditService.log('actualizar_alumno_grupo', {
        usuarioId: auditContext?.usuarioId ?? null,
        ip: auditContext?.ip ?? null,
        detalles: `alumnoId=${alumnoId} nuevoGrupoId=${grupoId ?? 'null'}`,
      });

      const resultadoActualizado = await this.prisma.persona.findUnique({
        where: { id: BigInt(alumnoData.personaId) },
        include: {
          administrador: true,
          director: { include: { escuela: true } },
          maestro: { include: { escuela: true } },
          alumno: { include: { escuela: true } },
          padre: true,
        },
      });
      const sinPassword = { ...(resultadoActualizado as any) };
      delete sinPassword.password;
      return { ...resultado, data: sinPassword };
    }

    return resultado;
  }

  async eliminarUsuarioPorId(id: number, auditContext?: AuditContext) {
    const persona = await this.prisma.persona.findUnique({
      where: { id: BigInt(id) },
      include: { administrador: true, director: true, maestro: true, alumno: true, padre: true },
    });

    if (!persona) throw new NotFoundException(`No se encontró el usuario con ID ${id}`);
    const tipo = persona.tipoPersona?.toLowerCase();
    const validTipos = ['administrador', 'director', 'maestro', 'alumno', 'padre'];
    if (!tipo || !validTipos.includes(tipo))
      throw new NotFoundException(`No se encontró el usuario con ID ${id}`);

    await this.prisma.$transaction(async (tx) => {
      if (tipo === 'padre' && persona.padre) {
        await tx.alumno.updateMany({ where: { padreId: persona.padre.id }, data: { padreId: null } });
        await tx.padre.delete({ where: { id: persona.padre.id } });
      } else if (tipo === 'alumno' && persona.alumno) {
        await tx.alumnoMaestro.deleteMany({ where: { alumnoId: persona.alumno.id } });
        await tx.alumno.delete({ where: { id: persona.alumno.id } });
      } else if (tipo === 'maestro' && persona.maestro) {
        await tx.maestro.delete({ where: { id: persona.maestro.id } });
      } else if (tipo === 'director' && persona.director) {
        await tx.director.delete({ where: { id: persona.director.id } });
      } else if (tipo === 'administrador' && persona.administrador) {
        await tx.administrador.delete({ where: { id: persona.administrador.id } });
      }

      await tx.persona.delete({ where: { id: BigInt(id) } });
    });

    await this.jwtPersonaLoader.invalidate(id);

    await this.auditService.log('eliminar_usuario', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `personaId: ${id} | ${persona.correo ?? ''} | tipo: ${tipo}`,
    });

    return {
      message: 'Usuario eliminado correctamente',
      description: `Se eliminó el usuario con ID ${id} (${tipo}).`,
    };
  }
}
