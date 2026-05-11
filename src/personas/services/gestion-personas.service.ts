import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Persona } from '../entities/persona.entity';
import { Administrador } from '../entities/administrador.entity';
import { Padre } from '../entities/padre.entity';
import { Alumno } from '../entities/alumno.entity';
import { Maestro } from '../entities/maestro.entity';
import { Director } from '../entities/director.entity';
import { AlumnoMaestro } from '../entities/alumno-maestro.entity';
import { Grupo } from '../../escuelas/entities/grupo.entity';
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
    @InjectRepository(Persona)
    private readonly personaRepository: Repository<Persona>,
    @InjectRepository(Alumno)
    private readonly alumnoRepository: Repository<Alumno>,
    @InjectRepository(Grupo)
    private readonly grupoRepository: Repository<Grupo>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly jwtPersonaLoader: JwtPersonaLoaderService,
    private readonly consultaPersonasService: ConsultaPersonasService,
  ) {}

  async actualizarUsuarioPorId(id: number, dto: ActualizarUsuarioDto, auditContext?: AuditContext) {
    const persona = await this.personaRepository.findOne({
      where: { id },
      relations: ['administrador', 'director', 'maestro', 'alumno', 'padre'],
    });

    if (!persona) throw new NotFoundException(`Usuario con ID ${id} no encontrado`);

    if (dto.correo != null && dto.correo.trim() !== '') {
      const correoObj = dto.correo.trim();
      if (correoObj !== persona.correo) {
        const otro = await this.personaRepository.findOne({
          where: { correo: correoObj },
          select: ['id'],
        });
        if (otro) throw new ConflictException('El correo ya está en uso por otro usuario');
      }
    }

    if (dto.nombre != null) persona.nombre = dto.nombre.trim();
    if (dto.apellidoPaterno != null) persona.apellidoPaterno = dto.apellidoPaterno.trim();
    if (dto.apellidoMaterno != null) persona.apellidoMaterno = dto.apellidoMaterno.trim() || null;
    if (dto.apellido != null) persona.apellidoPaterno = dto.apellido.trim(); // Compatibilidad
    if (dto.correo != null) persona.correo = dto.correo.trim() || null;
    if (dto.telefono != null) persona.telefono = dto.telefono.trim() || null;
    if (dto.fechaNacimiento != null) persona.fechaNacimiento = new Date(dto.fechaNacimiento);
    if (dto.genero != null) persona.genero = dto.genero.trim() || null;
    if (dto.activo != null) persona.activo = dto.activo;

    if (dto.password != null && dto.password.trim() !== '') {
      persona.password = await bcrypt.hash(dto.password, 10);
    }

    await this.personaRepository.save(persona);
    await this.jwtPersonaLoader.invalidate(id);

    await this.auditService.log('actualizar_usuario', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `personaId: ${id} | ${persona.correo ?? ''}`,
    });

    const resultado = await this.personaRepository.findOne({
      where: { id },
      relations: [
        'administrador',
        'director',
        'director.escuela',
        'maestro',
        'maestro.escuela',
        'alumno',
        'alumno.escuela',
        'padre',
      ],
      select: [
        'id',
        'nombre',
        'apellidoPaterno',
        'apellidoMaterno',
        'correo',
        'telefono',
        'fechaNacimiento',
        'genero',
        'tipoPersona',
        'activo',
      ],
    });
    return { message: 'Usuario actualizado correctamente', data: resultado };
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
      const alumno = await this.alumnoRepository.findOne({
        where: { id: alumnoId },
        relations: ['persona'],
      });
      if (!alumno) return resultado;
      const escuelaId = Number(alumno.escuelaId);
      if (escuelaIdRestriccion != null && Number(escuelaIdRestriccion) !== escuelaId)
        throw new ForbiddenException('No puedes modificar alumnos de otra escuela');

      if (grupoId == null) {
        alumno.grupoId = null;
        alumno.grupo = null;
      } else {
        const grupo = await this.grupoRepository.findOne({ where: { id: grupoId } });
        if (!grupo) throw new NotFoundException('Grupo no encontrado');
        if (Number(grupo.escuelaId) !== escuelaId)
          throw new ForbiddenException('El grupo no pertenece a la escuela del alumno');
        alumno.grupoId = grupo.id;
        alumno.grado = Number(grupo.grado);
        alumno.grupo = grupo.nombre;
      }
      await this.alumnoRepository.save(alumno);

      await this.auditService.log('actualizar_alumno_grupo', {
        usuarioId: auditContext?.usuarioId ?? null,
        ip: auditContext?.ip ?? null,
        detalles: `alumnoId=${alumnoId} nuevoGrupoId=${grupoId ?? 'null'}`,
      });

      const resultadoActualizado = await this.personaRepository.findOne({
        where: { id: alumnoData.personaId },
        relations: [
          'administrador',
          'director',
          'director.escuela',
          'maestro',
          'maestro.escuela',
          'alumno',
          'alumno.escuela',
          'padre',
        ],
        select: [
          'id',
          'nombre',
          'apellidoPaterno',
          'apellidoMaterno',
          'correo',
          'telefono',
          'fechaNacimiento',
          'genero',
          'tipoPersona',
          'activo',
        ],
      });
      return { ...resultado, data: resultadoActualizado };
    }

    return resultado;
  }

  async eliminarUsuarioPorId(id: number, auditContext?: AuditContext) {
    const persona = await this.personaRepository.findOne({
      where: { id },
      relations: ['administrador', 'director', 'maestro', 'alumno', 'padre'],
      select: ['id', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'correo', 'tipoPersona'],
    });

    if (!persona) throw new NotFoundException(`No se encontró el usuario con ID ${id}`);
    const tipo = persona.tipoPersona?.toLowerCase();
    const validTipos = ['administrador', 'director', 'maestro', 'alumno', 'padre'];
    if (!tipo || !validTipos.includes(tipo))
      throw new NotFoundException(`No se encontró el usuario con ID ${id}`);

    await this.dataSource.transaction(async (manager) => {
      const personaRepo = manager.getRepository(Persona);
      const adminRepo = manager.getRepository(Administrador);
      const directorRepo = manager.getRepository(Director);
      const maestroRepo = manager.getRepository(Maestro);
      const alumnoRepo = manager.getRepository(Alumno);
      const padreRepo = manager.getRepository(Padre);
      const alumnoMaestroRepo = manager.getRepository(AlumnoMaestro);

      if (tipo === 'padre' && persona.padre) {
        await alumnoRepo.update({ padreId: persona.padre.id }, { padreId: null });
        await padreRepo.delete({ id: persona.padre.id });
      } else if (tipo === 'alumno' && persona.alumno) {
        await alumnoMaestroRepo.delete({ alumnoId: persona.alumno.id });
        await alumnoRepo.delete({ id: persona.alumno.id });
      } else if (tipo === 'maestro' && persona.maestro) {
        await maestroRepo.delete({ id: persona.maestro.id });
      } else if (tipo === 'director' && persona.director) {
        await directorRepo.delete({ id: persona.director.id });
      } else if (tipo === 'administrador' && persona.administrador) {
        await adminRepo.delete({ id: persona.administrador.id });
      }

      await personaRepo.delete({ id });
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
