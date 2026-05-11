import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Persona } from '../entities/persona.entity';
import { Padre } from '../entities/padre.entity';
import { Alumno } from '../entities/alumno.entity';
import { Maestro } from '../entities/maestro.entity';
import { Director } from '../entities/director.entity';
import { Escuela } from '../entities/escuela.entity';
import { Grupo } from '../../escuelas/entities/grupo.entity';
import { AlumnoVinculacionPadre } from '../entities/alumno-vinculacion-padre.entity';
import { RegistroPadreDto } from '../dto/registro-padre.dto';
import { RegistroAlumnoDto } from '../dto/registro-alumno.dto';
import { RegistroMaestroDto } from '../dto/registro-maestro.dto';
import { RegistroDirectorDto } from '../dto/registro-director.dto';
import { RegistroPadreConHijoDto } from '../dto/registro-padre-con-hijo.dto';
import { AuditService } from '../../audit/audit.service';
import { VinculacionPadresService } from './vinculacion-padres.service';

export interface AuditContext {
  usuarioId?: number | null;
  ip?: string | null;
}

@Injectable()
export class RegistroPersonasService {
  private readonly logger = new Logger(RegistroPersonasService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly vinculacionPadresService: VinculacionPadresService,
  ) {}

  async registrarPadre(registroDto: RegistroPadreDto, auditContext?: AuditContext) {
    this.logger.log(`Intento de registro de padre: ${registroDto.email}`);

    return await this.dataSource.transaction(async (manager) => {
      const personaRepo = manager.getRepository(Persona);
      const padreRepo = manager.getRepository(Padre);
      const alumnoRepo = manager.getRepository(Alumno);
      const alumnoVinculacionRepo = manager.getRepository(AlumnoVinculacionPadre);

      const personaExistente = await personaRepo.findOne({
        where: { correo: registroDto.email },
        select: [
          'id',
          'nombre',
          'apellidoPaterno',
          'apellidoMaterno',
          'correo',
          'telefono',
          'fechaNacimiento',
          'genero',
        ],
      });

      if (personaExistente) throw new ConflictException('El email ya est? registrado');

      const hashedPassword = await bcrypt.hash(registroDto.password, 10);

      const persona = personaRepo.create({
        nombre: registroDto.nombre,
        apellidoPaterno: registroDto.apellidoPaterno,
        apellidoMaterno: registroDto.apellidoMaterno?.trim() || null,
        correo: registroDto.email,
        password: hashedPassword,
        telefono: registroDto.telefono,
        fechaNacimiento: registroDto.fechaNacimiento ? new Date(registroDto.fechaNacimiento) : null,
        tipoPersona: 'padre',
        activo: true,
      });

      const personaGuardada = await personaRepo.save(persona);
      const padre = padreRepo.create({ personaId: personaGuardada.id });
      const padreGuardado = await padreRepo.save(padre);

      if (registroDto.alumnoId != null) {
        const alumno = await alumnoRepo.findOne({ where: { id: registroDto.alumnoId } });
        if (alumno) {
          alumno.padreId = padreGuardado.id;
          await alumnoRepo.save(alumno);
          await alumnoVinculacionRepo.update(
            { alumnoId: alumno.id, usado: false },
            { usado: true, usadoEn: new Date() },
          );
        }
      }

      await this.auditService.log('registro_padre', {
        usuarioId: auditContext?.usuarioId ?? null,
        ip: auditContext?.ip ?? null,
        detalles: personaGuardada.correo,
      });

      const resultado = await personaRepo.findOne({
        where: { id: personaGuardada.id },
        relations: ['padre'],
        select: [
          'id',
          'nombre',
          'apellidoPaterno',
          'apellidoMaterno',
          'correo',
          'telefono',
          'fechaNacimiento',
          'genero',
        ],
      });

      const resultadoSinPassword = { ...(resultado as unknown as Record<string, unknown>) };
      delete (resultadoSinPassword as { password?: unknown }).password;

      return {
        message: 'Padre registrado exitosamente',
        description:
          'El padre/tutor ha sido creado correctamente. Puede iniciar sesi?n con su email y contrase?a.',
        data: resultadoSinPassword,
      };
    });
  }

  async registrarPadreConHijo(registroDto: RegistroPadreConHijoDto, auditContext?: AuditContext) {
    if (!registroDto?.hijo?.idEscuela) {
      throw new BadRequestException(
        'Debe indicar el ID de la escuela para el alumno (hijo.idEscuela)',
      );
    }

    return await this.dataSource.transaction(async (manager) => {
      const personaRepo = manager.getRepository(Persona);
      const padreRepo = manager.getRepository(Padre);
      const alumnoRepo = manager.getRepository(Alumno);
      const alumnoVinculacionRepo = manager.getRepository(AlumnoVinculacionPadre);
      const escuelaRepo = manager.getRepository(Escuela);
      const grupoRepo = manager.getRepository(Grupo);

      const padreDto = registroDto.padre;
      const hijoDto = registroDto.hijo;

      if (await personaRepo.findOne({ where: { correo: padreDto.email }, select: ['id'] })) {
        throw new ConflictException('El email del padre ya est? registrado');
      }
      if (await personaRepo.findOne({ where: { correo: hijoDto.email }, select: ['id'] })) {
        throw new ConflictException('El email del alumno ya est? registrado');
      }

      const escuela = await escuelaRepo.findOne({ where: { id: hijoDto.idEscuela } });
      if (!escuela)
        throw new NotFoundException(`No se encontr? la escuela con ID ${hijoDto.idEscuela}`);

      let grupoId: number | null = null;
      let gradoFinal = hijoDto.grado ? parseInt(hijoDto.grado.toString()) : 1;
      let grupoNombre: string | null = hijoDto.grupo?.trim() || null;

      if (hijoDto.grupoId != null) {
        const g = await grupoRepo.findOne({
          where: { id: hijoDto.grupoId, escuelaId: hijoDto.idEscuela, activo: true },
        });
        if (!g)
          throw new NotFoundException(
            `No existe el grupo con ID ${hijoDto.grupoId} en esta escuela`,
          );
        grupoId = g.id;
        gradoFinal = Number(g.grado);
        grupoNombre = g.nombre;
      } else if (hijoDto.grado != null && hijoDto.grupo != null && hijoDto.grupo.trim() !== '') {
        const grupoNorm = hijoDto.grupo.trim().toUpperCase();
        const grupos = await grupoRepo.find({
          where: { escuelaId: hijoDto.idEscuela!, grado: hijoDto.grado, activo: true },
        });
        const g = grupos.find((x) => x.nombre.trim().toUpperCase() === grupoNorm);
        if (!g)
          throw new BadRequestException(
            `No existe un grupo con grado ${hijoDto.grado} y nombre "${hijoDto.grupo}".`,
          );
        grupoId = g.id;
        gradoFinal = Number(g.grado);
        grupoNombre = g.nombre;
      }

      const hashedPasswordPadre = await bcrypt.hash(padreDto.password, 10);
      const personaPadre = personaRepo.create({
        nombre: padreDto.nombre,
        apellidoPaterno: padreDto.apellidoPaterno,
        apellidoMaterno: padreDto.apellidoMaterno?.trim() || null,
        correo: padreDto.email,
        password: hashedPasswordPadre,
        telefono: padreDto.telefono,
        fechaNacimiento: padreDto.fechaNacimiento ? new Date(padreDto.fechaNacimiento) : null,
        tipoPersona: 'padre',
        activo: true,
      });
      const personaPadreGuardada = await personaRepo.save(personaPadre);
      const padreGuardado = await padreRepo.save(
        padreRepo.create({ personaId: personaPadreGuardada.id }),
      );

      const hashedPasswordHijo = await bcrypt.hash(hijoDto.password, 10);
      const personaHijo = personaRepo.create({
        nombre: hijoDto.nombre,
        apellidoPaterno: hijoDto.apellidoPaterno,
        apellidoMaterno: hijoDto.apellidoMaterno?.trim() || null,
        correo: hijoDto.email,
        password: hashedPasswordHijo,
        telefono: hijoDto.telefono,
        fechaNacimiento: hijoDto.fechaNacimiento ? new Date(hijoDto.fechaNacimiento) : null,
        tipoPersona: 'alumno',
        activo: true,
      });
      const personaHijoGuardada = await personaRepo.save(personaHijo);

      const alumnoGuardado = await alumnoRepo.save(
        alumnoRepo.create({
          personaId: personaHijoGuardada.id,
          escuelaId: hijoDto.idEscuela!,
          grado: gradoFinal,
          grupo: grupoNombre,
          grupoId,
          cicloEscolar: hijoDto.cicloEscolar || null,
          padreId: padreGuardado.id,
          activo: true,
        }),
      );

      await this.vinculacionPadresService.crearCodigoVinculacionParaAlumnoTransactional(
        alumnoGuardado.id,
        alumnoVinculacionRepo,
      );
      await alumnoVinculacionRepo.update(
        { alumnoId: alumnoGuardado.id, usado: false },
        { usado: true, usadoEn: new Date() },
      );

      await this.auditService.log('registro_padre_con_hijo', {
        usuarioId: auditContext?.usuarioId ?? null,
        ip: auditContext?.ip ?? null,
        detalles: `${padreDto.email} | alumno=${hijoDto.email} | escuelaId=${hijoDto.idEscuela}`,
      });

      const padreResult = await personaRepo.findOne({
        where: { id: personaPadreGuardada.id },
        relations: ['padre'],
        select: [
          'id',
          'nombre',
          'apellidoPaterno',
          'apellidoMaterno',
          'correo',
          'telefono',
          'fechaNacimiento',
          'genero',
        ],
      });
      const hijoResult = await personaRepo.findOne({
        where: { id: personaHijoGuardada.id },
        relations: ['alumno', 'alumno.escuela'],
        select: [
          'id',
          'nombre',
          'apellidoPaterno',
          'apellidoMaterno',
          'correo',
          'telefono',
          'fechaNacimiento',
          'genero',
        ],
      });

      const padreSinPassword = { ...(padreResult as unknown as Record<string, unknown>) };
      delete (padreSinPassword as { password?: unknown }).password;
      const hijoSinPassword = { ...(hijoResult as unknown as Record<string, unknown>) };
      delete (hijoSinPassword as { password?: unknown }).password;

      return {
        message: 'Padre e hijo registrados exitosamente',
        description: 'Los usuarios han sido creados y vinculados correctamente',
        data: { padre: padreSinPassword, hijo: hijoSinPassword },
      };
    });
  }

  async registrarAlumno(registroDto: RegistroAlumnoDto, auditContext?: AuditContext) {
    const resultado = await this.dataSource.transaction(async (manager) => {
      const personaRepo = manager.getRepository(Persona);
      const alumnoRepo = manager.getRepository(Alumno);
      const escuelaRepo = manager.getRepository(Escuela);
      const grupoRepo = manager.getRepository(Grupo);
      const alumnoVinculacionRepo = manager.getRepository(AlumnoVinculacionPadre);

      if (await personaRepo.findOne({ where: { correo: registroDto.email }, select: ['id'] })) {
        throw new ConflictException('El email ya est? registrado');
      }

      if (!(await escuelaRepo.findOne({ where: { id: registroDto.idEscuela } }))) {
        throw new NotFoundException(`No se encontr? la escuela con ID ${registroDto.idEscuela}`);
      }

      let grupoId: number | null = null;
      let gradoFinal = registroDto.grado ? parseInt(registroDto.grado.toString()) : 1;
      let grupoNombre: string | null = registroDto.grupo?.trim() || null;

      if (registroDto.grupoId != null) {
        const g = await grupoRepo.findOne({
          where: { id: registroDto.grupoId, escuelaId: registroDto.idEscuela, activo: true },
        });
        if (!g) throw new NotFoundException(`No existe el grupo con ID ${registroDto.grupoId}`);
        grupoId = g.id;
        gradoFinal = Number(g.grado);
        grupoNombre = g.nombre;
      } else if (
        registroDto.grado != null &&
        registroDto.grupo != null &&
        registroDto.grupo.trim() !== ''
      ) {
        const grupoNorm = registroDto.grupo.trim().toUpperCase();
        const grupos = await grupoRepo.find({
          where: { escuelaId: registroDto.idEscuela!, grado: registroDto.grado, activo: true },
        });
        const g = grupos.find((x) => x.nombre.trim().toUpperCase() === grupoNorm);
        if (!g)
          throw new BadRequestException(
            `No existe un grupo con grado ${registroDto.grado} y nombre "${registroDto.grupo}".`,
          );
        grupoId = g.id;
        gradoFinal = Number(g.grado);
        grupoNombre = g.nombre;
      }

      const hashedPassword = await bcrypt.hash(registroDto.password, 10);
      const persona = personaRepo.create({
        nombre: registroDto.nombre,
        apellidoPaterno: registroDto.apellidoPaterno,
        apellidoMaterno: registroDto.apellidoMaterno?.trim() || null,
        correo: registroDto.email,
        password: hashedPassword,
        telefono: registroDto.telefono,
        fechaNacimiento: registroDto.fechaNacimiento ? new Date(registroDto.fechaNacimiento) : null,
        tipoPersona: 'alumno',
        activo: true,
      });
      const personaGuardada = await personaRepo.save(persona);

      const alumnoGuardado = await alumnoRepo.save(
        alumnoRepo.create({
          personaId: personaGuardada.id,
          escuelaId: registroDto.idEscuela,
          grado: gradoFinal,
          grupo: grupoNombre,
          grupoId,
          cicloEscolar: registroDto.cicloEscolar || null,
          padreId: null,
        }),
      );

      await this.vinculacionPadresService.crearCodigoVinculacionParaAlumnoTransactional(
        alumnoGuardado.id,
        alumnoVinculacionRepo,
      );

      const res = await personaRepo.findOne({
        where: { id: personaGuardada.id },
        relations: ['alumno', 'alumno.escuela'],
        select: [
          'id',
          'nombre',
          'apellidoPaterno',
          'apellidoMaterno',
          'correo',
          'telefono',
          'fechaNacimiento',
          'genero',
        ],
      });
      const sinPassword = { ...(res as unknown as Record<string, unknown>) };
      delete (sinPassword as { password?: unknown }).password;
      return { personaGuardada, resultadoSinPassword: sinPassword };
    });

    await this.auditService.log('registro_alumno', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `${resultado.personaGuardada.correo} | escuelaId: ${registroDto.idEscuela}`,
    });

    return {
      message: 'Alumno registrado exitosamente',
      description: 'El alumno ha sido creado.',
      data: resultado.resultadoSinPassword,
    };
  }

  async registrarMaestro(registroDto: RegistroMaestroDto, auditContext?: AuditContext) {
    const resultado = await this.dataSource.transaction(async (manager) => {
      const personaRepo = manager.getRepository(Persona);
      const maestroRepo = manager.getRepository(Maestro);
      const escuelaRepo = manager.getRepository(Escuela);

      if (await personaRepo.findOne({ where: { correo: registroDto.email }, select: ['id'] }))
        throw new ConflictException('El email ya est? registrado');
      if (!(await escuelaRepo.findOne({ where: { id: registroDto.idEscuela } })))
        throw new NotFoundException(`No se encontr? la escuela con ID ${registroDto.idEscuela}`);

      const hashedPassword = await bcrypt.hash(registroDto.password, 10);
      const persona = personaRepo.create({
        nombre: registroDto.nombre,
        apellidoPaterno: registroDto.apellidoPaterno,
        apellidoMaterno: registroDto.apellidoMaterno?.trim() || null,
        correo: registroDto.email,
        password: hashedPassword,
        telefono: registroDto.telefono,
        fechaNacimiento: registroDto.fechaNacimiento ? new Date(registroDto.fechaNacimiento) : null,
        tipoPersona: 'maestro',
        activo: true,
      });
      const personaGuardada = await personaRepo.save(persona);

      await maestroRepo.save(
        maestroRepo.create({
          personaId: personaGuardada.id,
          escuelaId: registroDto.idEscuela,
          especialidad: registroDto.especialidad,
          fechaContratacion: registroDto.fechaIngreso ? new Date(registroDto.fechaIngreso) : null,
        }),
      );

      const res = await personaRepo.findOne({
        where: { id: personaGuardada.id },
        relations: ['maestro', 'maestro.escuela'],
        select: [
          'id',
          'nombre',
          'apellidoPaterno',
          'apellidoMaterno',
          'correo',
          'telefono',
          'fechaNacimiento',
          'genero',
        ],
      });
      const sinPassword = { ...(res as unknown as Record<string, unknown>) };
      delete (sinPassword as { password?: unknown }).password;
      return { personaGuardada, resultadoSinPassword: sinPassword };
    });

    await this.auditService.log('registro_maestro', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `${resultado.personaGuardada.correo} | escuelaId: ${registroDto.idEscuela}`,
    });

    return {
      message: 'Maestro registrado exitosamente',
      description: 'El maestro ha sido creado.',
      data: resultado.resultadoSinPassword,
    };
  }

  async registrarDirector(registroDto: RegistroDirectorDto, auditContext?: AuditContext) {
    const resultado = await this.dataSource.transaction(async (manager) => {
      const personaRepo = manager.getRepository(Persona);
      const directorRepo = manager.getRepository(Director);
      const escuelaRepo = manager.getRepository(Escuela);

      if (await personaRepo.findOne({ where: { correo: registroDto.email }, select: ['id'] }))
        throw new ConflictException('El email ya est? registrado');
      if (!(await escuelaRepo.findOne({ where: { id: registroDto.idEscuela } })))
        throw new NotFoundException(`No se encontr? la escuela con ID ${registroDto.idEscuela}`);

      const cantidadDirectores = await directorRepo.count({
        where: { escuelaId: registroDto.idEscuela },
      });
      if (cantidadDirectores >= 3)
        throw new ConflictException('Esta escuela ya tiene el m?ximo de 3 directores asignados');

      const hashedPassword = await bcrypt.hash(registroDto.password, 10);
      const persona = personaRepo.create({
        nombre: registroDto.nombre,
        apellidoPaterno: registroDto.apellidoPaterno,
        apellidoMaterno: registroDto.apellidoMaterno?.trim() || null,
        correo: registroDto.email,
        password: hashedPassword,
        telefono: registroDto.telefono,
        fechaNacimiento: registroDto.fechaNacimiento ? new Date(registroDto.fechaNacimiento) : null,
        tipoPersona: 'director',
        activo: true,
      });
      const personaGuardada = await personaRepo.save(persona);

      await directorRepo.save(
        directorRepo.create({
          personaId: personaGuardada.id,
          escuelaId: registroDto.idEscuela,
          fechaNombramiento: registroDto.fechaNombramiento
            ? new Date(registroDto.fechaNombramiento)
            : new Date(),
        }),
      );

      const res = await personaRepo.findOne({
        where: { id: personaGuardada.id },
        relations: ['director', 'director.escuela'],
        select: [
          'id',
          'nombre',
          'apellidoPaterno',
          'apellidoMaterno',
          'correo',
          'telefono',
          'fechaNacimiento',
          'genero',
        ],
      });
      const sinPassword = { ...(res as unknown as Record<string, unknown>) };
      delete (sinPassword as { password?: unknown }).password;
      return { personaGuardada, resultadoSinPassword: sinPassword };
    });

    await this.auditService.log('registro_director', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `${resultado.personaGuardada.correo} | escuelaId: ${registroDto.idEscuela}`,
    });

    return {
      message: 'Director registrado exitosamente',
      description: 'El director ha sido creado.',
      data: resultado.resultadoSinPassword,
    };
  }
}
