/**
 * ============================================
 * SERVICIO: PersonasService
 * ============================================
 * 
 * Servicio que maneja el registro de usuarios con diferentes roles.
 * - Permite registrar hasta 3 administradores iniciales (sin autenticación)
 * - Los demás usuarios solo pueden ser creados por administradores
 */

import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, Not } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Persona } from './entities/persona.entity';
import { Administrador } from './entities/administrador.entity';
import { Padre } from './entities/padre.entity';
import { Alumno } from './entities/alumno.entity';
import { Maestro } from './entities/maestro.entity';
import { Director } from './entities/director.entity';
import { Escuela } from './entities/escuela.entity';
import { AlumnoMaestro } from './entities/alumno-maestro.entity';
import { AlumnoVinculacionPadre } from './entities/alumno-vinculacion-padre.entity';
import { Grupo } from '../escuelas/entities/grupo.entity';
import { RegistroPadreDto } from './dto/registro-padre.dto';
import { RegistroAlumnoDto } from './dto/registro-alumno.dto';
import { RegistroMaestroDto } from './dto/registro-maestro.dto';
import { RegistroDirectorDto } from './dto/registro-director.dto';
import { RegistroPadreConHijoDto } from './dto/registro-padre-con-hijo.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { AuditService } from '../audit/audit.service';
import { MAX_PAGE_SIZE, MAX_PAGE_NUMBER } from '../common/constants/validation.constants';
import { mapPersonaToUsuarioListItem } from './mappers/usuario.mapper';

export interface AuditContext {
  usuarioId?: number | null;
  ip?: string | null;
}

@Injectable()
export class PersonasService {
  private readonly logger = new Logger(PersonasService.name);
  private readonly MAX_ADMINS_INICIALES = 3;

  constructor(
    @InjectRepository(Persona)
    private readonly personaRepository: Repository<Persona>,
    @InjectRepository(Administrador)
    private readonly administradorRepository: Repository<Administrador>,
    @InjectRepository(Padre)
    private readonly padreRepository: Repository<Padre>,
    @InjectRepository(Alumno)
    private readonly alumnoRepository: Repository<Alumno>,
    @InjectRepository(AlumnoVinculacionPadre)
    private readonly alumnoVinculacionPadreRepository: Repository<AlumnoVinculacionPadre>,
    @InjectRepository(Maestro)
    private readonly maestroRepository: Repository<Maestro>,
    @InjectRepository(Director)
    private readonly directorRepository: Repository<Director>,
    @InjectRepository(Escuela)
    private readonly escuelaRepository: Repository<Escuela>,
    @InjectRepository(Grupo)
    private readonly grupoRepository: Repository<Grupo>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  // Nota: El registro de admin está en AuthService

  /**
   * Registrar un padre (solo por administrador)
   * Usa transacción para garantizar atomicidad: persona + padre + vinculación alumno.
   */
  async registrarPadre(registroDto: RegistroPadreDto, auditContext?: AuditContext) {
    this.logger.log(`Intento de registro de padre: ${registroDto.email}`);

    return await this.dataSource.transaction(async (manager) => {
      const personaRepo = manager.getRepository(Persona);
      const padreRepo = manager.getRepository(Padre);
      const alumnoRepo = manager.getRepository(Alumno);
      const alumnoVinculacionRepo = manager.getRepository(AlumnoVinculacionPadre);

      const personaExistente = await personaRepo.findOne({
        where: { correo: registroDto.email },
        select: ['id', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'correo', 'telefono', 'fechaNacimiento', 'genero'],
      });

      if (personaExistente) {
        this.logger.warn(`Registro fallido: Email ya registrado - ${registroDto.email}`);
        throw new ConflictException('El email ya está registrado');
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(registroDto.password, saltRounds);

      const persona = personaRepo.create({
        nombre: registroDto.nombre,
        apellidoPaterno: registroDto.apellidoPaterno,
        apellidoMaterno: registroDto.apellidoMaterno?.trim() || null,
        correo: registroDto.email,
        password: hashedPassword,
        telefono: registroDto.telefono,
        fechaNacimiento: registroDto.fechaNacimiento
          ? new Date(registroDto.fechaNacimiento)
          : null,
        tipoPersona: 'padre',
        activo: true,
      });

      const personaGuardada = await personaRepo.save(persona);

      const padre = padreRepo.create({
        personaId: personaGuardada.id,
      });

      const padreGuardado = await padreRepo.save(padre);

      if (registroDto.alumnoId != null) {
        const alumno = await alumnoRepo.findOne({ where: { id: registroDto.alumnoId } });
        if (alumno) {
          alumno.padreId = padreGuardado.id;
          await alumnoRepo.save(alumno);
          this.logger.log(`Alumno ID ${alumno.id} vinculado al padre ID ${padreGuardado.id}`);

          // Si había un código de vinculación pendiente para este alumno, márcalo como usado
          await alumnoVinculacionRepo.update(
            { alumnoId: alumno.id, usado: false },
            { usado: true, usadoEn: new Date() },
          );
        }
      }

      this.logger.log(`Padre creado exitosamente: ${personaGuardada.nombre} ${personaGuardada.apellidoPaterno} - ID: ${personaGuardada.id}`);

      await this.auditService.log('registro_padre', {
        usuarioId: auditContext?.usuarioId ?? null,
        ip: auditContext?.ip ?? null,
        detalles: personaGuardada.correo,
      });

      const resultado = await personaRepo.findOne({
        where: { id: personaGuardada.id },
        relations: ['padre'],
        select: ['id', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'correo', 'telefono', 'fechaNacimiento', 'genero'],
      });

      const { password, ...resultadoSinPassword } = resultado;

      return {
        message: 'Padre registrado exitosamente',
        description: 'El padre/tutor ha sido creado correctamente. Puede iniciar sesión con su email y contraseña.',
        data: resultadoSinPassword,
      };
    });
  }

  /**
   * Registrar un padre/tutor y un alumno (hijo) en una sola operación.
   * Se crea el padre + el alumno y se vinculan directamente.
   */
  async registrarPadreConHijo(registroDto: RegistroPadreConHijoDto, auditContext?: AuditContext) {
    this.logger.log(
      `Intento de registro de padre+alumno: ${registroDto.padre.email} -> hijo=${registroDto.hijo.email}`,
    );

    if (!registroDto?.hijo?.idEscuela) {
      throw new BadRequestException('Debe indicar el ID de la escuela para el alumno (hijo.idEscuela)');
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

      // Validación: correo del padre único
      const personaPadreExistente = await personaRepo.findOne({
        where: { correo: padreDto.email },
        select: ['id'],
      });
      if (personaPadreExistente) {
        throw new ConflictException('El email del padre ya está registrado');
      }

      // Validación: correo del hijo único
      const personaHijoExistente = await personaRepo.findOne({
        where: { correo: hijoDto.email },
        select: ['id'],
      });
      if (personaHijoExistente) {
        throw new ConflictException('El email del alumno ya está registrado');
      }

      const escuela = await escuelaRepo.findOne({ where: { id: hijoDto.idEscuela } });
      if (!escuela) {
        throw new NotFoundException(`No se encontró la escuela con ID ${hijoDto.idEscuela}`);
      }

      let grupoId: number | null = null;
      let gradoFinal = hijoDto.grado ? parseInt(hijoDto.grado.toString()) : 1;
      let grupoNombre: string | null = hijoDto.grupo?.trim() || null;

      if (hijoDto.grupoId != null) {
        const g = await grupoRepo.findOne({
          where: { id: hijoDto.grupoId, escuelaId: hijoDto.idEscuela, activo: true },
        });
        if (!g) {
          throw new NotFoundException(
            `No existe el grupo con ID ${hijoDto.grupoId} en esta escuela`,
          );
        }
        grupoId = g.id;
        gradoFinal = Number(g.grado);
        grupoNombre = g.nombre;
      } else if (
        hijoDto.grado != null &&
        hijoDto.grupo != null &&
        hijoDto.grupo.trim() !== ''
      ) {
        const grupoNorm = hijoDto.grupo.trim().toUpperCase();
        const grupos = await grupoRepo.find({
          where: { escuelaId: hijoDto.idEscuela!, grado: hijoDto.grado, activo: true },
        });
        const g = grupos.find((x) => x.nombre.trim().toUpperCase() === grupoNorm);
        if (!g) {
          throw new BadRequestException(
            `No existe un grupo con grado ${hijoDto.grado} y nombre "${hijoDto.grupo}". El admin/director debe crearlo primero.`,
          );
        }
        grupoId = g.id;
        gradoFinal = Number(g.grado);
        grupoNombre = g.nombre;
      }

      // Padre
      const saltRounds = 10;
      const hashedPasswordPadre = await bcrypt.hash(padreDto.password, saltRounds);
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

      const padre = padreRepo.create({
        personaId: personaPadreGuardada.id,
      });
      const padreGuardado = await padreRepo.save(padre);

      // Hijo (alumno)
      const hashedPasswordHijo = await bcrypt.hash(hijoDto.password, saltRounds);
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

      const alumno = alumnoRepo.create({
        personaId: personaHijoGuardada.id,
        escuelaId: hijoDto.idEscuela!,
        grado: gradoFinal,
        grupo: grupoNombre,
        grupoId,
        cicloEscolar: hijoDto.cicloEscolar || null,
        padreId: padreGuardado.id,
        activo: true,
      });
      const alumnoGuardado = await alumnoRepo.save(alumno);

      // Crear código de vinculación del alumno y marcarlo como usado
      // (evita que luego sea reutilizado para vincular al mismo alumno a otro padre).
      await this.crearCodigoVinculacionParaAlumnoTransactional(
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

      const [padreResult, hijoResult] = await Promise.all([
        personaRepo.findOne({
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
        }),
        personaRepo.findOne({
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
        }),
      ]);

      if (!padreResult || !hijoResult) {
        throw new BadRequestException('Error interno: no se pudo obtener el resultado del registro');
      }

      // Nota: password no está seleccionado, pero lo dejamos por claridad/seguridad.
      const { password: _padrePw, ...padreSinPassword } = padreResult as any;
      const { password: _hijoPw, ...hijoSinPassword } = hijoResult as any;

      return {
        message: 'Padre e hijo registrados exitosamente',
        description: 'Los usuarios han sido creados y vinculados correctamente',
        data: {
          padre: padreSinPassword,
          hijo: hijoSinPassword,
        },
      };
    });
  }

  /**
   * Registrar un alumno
   */
  async registrarAlumno(registroDto: RegistroAlumnoDto, auditContext?: AuditContext) {
    this.logger.log(`Intento de registro de alumno: ${registroDto.email}`);

    const resultado = await this.dataSource.transaction(async (manager) => {
      const personaRepo = manager.getRepository(Persona);
      const alumnoRepo = manager.getRepository(Alumno);
      const escuelaRepo = manager.getRepository(Escuela);
      const grupoRepo = manager.getRepository(Grupo);
      const alumnoVinculacionRepo = manager.getRepository(AlumnoVinculacionPadre);

      const personaExistente = await personaRepo.findOne({
        where: { correo: registroDto.email },
        select: ['id'],
      });
      if (personaExistente) {
        throw new ConflictException('El email ya está registrado');
      }

      const escuela = await escuelaRepo.findOne({ where: { id: registroDto.idEscuela } });
      if (!escuela) {
        throw new NotFoundException(`No se encontró la escuela con ID ${registroDto.idEscuela}`);
      }

      let grupoId: number | null = null;
      let gradoFinal = registroDto.grado ? parseInt(registroDto.grado.toString()) : 1;
      let grupoNombre: string | null = registroDto.grupo?.trim() || null;

      if (registroDto.grupoId != null) {
        const g = await grupoRepo.findOne({ where: { id: registroDto.grupoId, escuelaId: registroDto.idEscuela, activo: true } });
        if (!g) {
          throw new NotFoundException(`No existe el grupo con ID ${registroDto.grupoId} en esta escuela`);
        }
        grupoId = g.id;
        gradoFinal = Number(g.grado);
        grupoNombre = g.nombre;
      } else if (registroDto.grado != null && registroDto.grupo != null && registroDto.grupo.trim() !== '') {
        const grupoNorm = registroDto.grupo.trim().toUpperCase();
        const grupos = await grupoRepo.find({ where: { escuelaId: registroDto.idEscuela!, grado: registroDto.grado, activo: true } });
        const g = grupos.find((x) => x.nombre.trim().toUpperCase() === grupoNorm);
        if (!g) {
          throw new BadRequestException(`No existe un grupo con grado ${registroDto.grado} y nombre "${registroDto.grupo}" en esta escuela. El director debe crearlo primero.`);
        }
        grupoId = g.id;
        gradoFinal = Number(g.grado);
        grupoNombre = g.nombre;
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(registroDto.password, saltRounds);

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

      const alumno = alumnoRepo.create({
        personaId: personaGuardada.id,
        escuelaId: registroDto.idEscuela,
        grado: gradoFinal,
        grupo: grupoNombre,
        grupoId,
        cicloEscolar: registroDto.cicloEscolar || null,
        padreId: null,
      });
      const alumnoGuardado = await alumnoRepo.save(alumno);

      // Crear código de vinculación para padre/tutor (una sola vez por alumno al registrarse)
      await this.crearCodigoVinculacionParaAlumnoTransactional(alumnoGuardado.id, alumnoVinculacionRepo);

      const res = await personaRepo.findOne({
        where: { id: personaGuardada.id },
        relations: ['alumno', 'alumno.escuela'],
        select: ['id', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'correo', 'telefono', 'fechaNacimiento', 'genero'],
      });
      const { password, ...sinPassword } = res;
      return { personaGuardada, resultadoSinPassword: sinPassword };
    });

    this.logger.log(`Alumno creado exitosamente: ${resultado.personaGuardada.nombre} - ID: ${resultado.personaGuardada.id}`);
    await this.auditService.log('registro_alumno', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `${resultado.personaGuardada.correo} | escuelaId: ${registroDto.idEscuela}`,
    });

    return {
      message: 'Alumno registrado exitosamente',
      description: 'El alumno ha sido creado correctamente. Puede iniciar sesión con su email y contraseña.',
      data: resultado.resultadoSinPassword,
    };
  }

  /**
   * Crea un código de vinculación para un alumno dentro de una transacción existente.
   */
  private async crearCodigoVinculacionParaAlumnoTransactional(
    alumnoId: number,
    repo: Repository<AlumnoVinculacionPadre>,
  ): Promise<AlumnoVinculacionPadre> {
    const codigo = this.generarCodigoVinculacion();
    const ahora = new Date();
    const expiraEn = new Date(ahora.getTime() + 100 * 24 * 60 * 60 * 1000); // 100 días

    const entidad = repo.create({
      alumnoId,
      codigo,
      usado: false,
      usadoEn: null,
      expiraEn,
    });

    try {
      return await repo.save(entidad);
    } catch (e) {
      // En el caso extremadamente raro de colisión de código, reintentamos una vez
      const entidadRetry = repo.create({
        alumnoId,
        codigo: this.generarCodigoVinculacion(),
        usado: false,
        usadoEn: null,
        expiraEn,
      });
      return await repo.save(entidadRetry);
    }
  }

  /**
   * Genera un código aleatorio, no predecible, para vinculación padre–alumno.
   */
  private generarCodigoVinculacion(): string {
    // 16 bytes -> 32 caracteres hex (suficiente y no predecible)
    // Se usa require en vez de import para evitar problemas en entornos donde crypto no está tipeado.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { randomBytes } = require('crypto') as typeof import('crypto');
    return randomBytes(16).toString('hex');
  }

  /**
   * Registrar un maestro (solo por administrador)
   */
  async registrarMaestro(registroDto: RegistroMaestroDto, auditContext?: AuditContext) {
    this.logger.log(`Intento de registro de maestro: ${registroDto.email}`);

    const resultado = await this.dataSource.transaction(async (manager) => {
      const personaRepo = manager.getRepository(Persona);
      const maestroRepo = manager.getRepository(Maestro);
      const escuelaRepo = manager.getRepository(Escuela);

      const personaExistente = await personaRepo.findOne({ where: { correo: registroDto.email }, select: ['id'] });
      if (personaExistente) throw new ConflictException('El email ya está registrado');

      const escuela = await escuelaRepo.findOne({ where: { id: registroDto.idEscuela } });
      if (!escuela) throw new NotFoundException(`No se encontró la escuela con ID ${registroDto.idEscuela}`);

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(registroDto.password, saltRounds);

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

      const maestro = maestroRepo.create({
        personaId: personaGuardada.id,
        escuelaId: registroDto.idEscuela,
        especialidad: registroDto.especialidad,
        fechaContratacion: registroDto.fechaIngreso ? new Date(registroDto.fechaIngreso) : null,
      });
      await maestroRepo.save(maestro);

      const res = await personaRepo.findOne({
        where: { id: personaGuardada.id },
        relations: ['maestro', 'maestro.escuela'],
        select: ['id', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'correo', 'telefono', 'fechaNacimiento', 'genero'],
      });
      const { password, ...sinPassword } = res;
      return { personaGuardada, resultadoSinPassword: sinPassword };
    });

    this.logger.log(`Maestro creado exitosamente: ${resultado.personaGuardada.nombre} - ID: ${resultado.personaGuardada.id}`);
    await this.auditService.log('registro_maestro', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `${resultado.personaGuardada.correo} | escuelaId: ${registroDto.idEscuela}`,
    });

    return {
      message: 'Maestro registrado exitosamente',
      description: 'El maestro/profesor ha sido creado correctamente. Puede iniciar sesión con su email y contraseña.',
      data: resultado.resultadoSinPassword,
    };
  }

  /**
   * Obtener todos los administradores
   */
  async obtenerAdmins() {
    // Buscar personas que tienen relación con Administrador
    const admins = await this.personaRepository
      .createQueryBuilder('persona')
      .leftJoinAndSelect('persona.administrador', 'administrador')
      .where('administrador.id IS NOT NULL')
      .select([
        'persona.id',
        'persona.nombre',
        'persona.apellidoPaterno',
        'persona.apellidoMaterno',
        'persona.correo',
        'persona.telefono',
        'persona.fechaNacimiento',
        'persona.genero',
        'administrador.id',
        'administrador.personaId',
        'administrador.fechaAlta',
      ])
      .getMany();

    this.logger.log(`Consulta de administradores: ${admins.length} encontrados`);

    return {
      message: 'Administradores obtenidos exitosamente',
      description: `Se encontraron ${admins.length} administrador(es) en el sistema`,
      total: admins.length,
      data: admins,
    };
  }

  /**
   * Registrar un director (solo por administrador)
   */
  async registrarDirector(registroDto: RegistroDirectorDto, auditContext?: AuditContext) {
    this.logger.log(`Intento de registro de director: ${registroDto.email}`);

    const MAX_DIRECTORES_POR_ESCUELA = 3;

    const resultado = await this.dataSource.transaction(async (manager) => {
      const personaRepo = manager.getRepository(Persona);
      const directorRepo = manager.getRepository(Director);
      const escuelaRepo = manager.getRepository(Escuela);

      const personaExistente = await personaRepo.findOne({ where: { correo: registroDto.email }, select: ['id'] });
      if (personaExistente) throw new ConflictException('El email ya está registrado');

      const escuela = await escuelaRepo.findOne({ where: { id: registroDto.idEscuela } });
      if (!escuela) throw new NotFoundException(`No se encontró la escuela con ID ${registroDto.idEscuela}`);

      const cantidadDirectores = await directorRepo.count({ where: { escuelaId: registroDto.idEscuela } });
      if (cantidadDirectores >= MAX_DIRECTORES_POR_ESCUELA) {
        throw new ConflictException(`Esta escuela ya tiene el máximo de ${MAX_DIRECTORES_POR_ESCUELA} directores asignados`);
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(registroDto.password, saltRounds);

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

      const director = directorRepo.create({
        personaId: personaGuardada.id,
        escuelaId: registroDto.idEscuela,
        fechaNombramiento: registroDto.fechaNombramiento ? new Date(registroDto.fechaNombramiento) : new Date(),
      });
      await directorRepo.save(director);

      const res = await personaRepo.findOne({
        where: { id: personaGuardada.id },
        relations: ['director', 'director.escuela'],
        select: ['id', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'correo', 'telefono', 'fechaNacimiento', 'genero'],
      });
      const { password, ...sinPassword } = res;
      return { personaGuardada, resultadoSinPassword: sinPassword };
    });

    this.logger.log(`Director creado exitosamente: ${resultado.personaGuardada.nombre} - ID: ${resultado.personaGuardada.id}`);
    await this.auditService.log('registro_director', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `${resultado.personaGuardada.correo} | escuelaId: ${registroDto.idEscuela}`,
    });

    return {
      message: 'Director registrado exitosamente',
      description: 'El director ha sido creado correctamente. Puede iniciar sesión con su email y contraseña.',
      data: resultado.resultadoSinPassword,
    };
  }

  /**
   * Obtener cantidad de administradores registrados
   */
  async contarAdmins(): Promise<number> {
    return await this.administradorRepository.count();
  }

  /**
   * Obtener todos los usuarios del sistema con totales por rol.
   * Solo administradores. Incluye resumen de cantidad por cada rol al inicio.
   */
  async obtenerTodosUsuariosConTotales(): Promise<{
    message: string;
    totalesPorRol: {
      administrador: number;
      director: number;
      maestro: number;
      alumno: number;
      padre: number;
      total: number;
    };
    total: number;
    data: Array<{
      id: number;
      nombre: string;
      apellidoPaterno: string;
      apellidoMaterno: string | null;
      correo: string | null;
      telefono: string | null;
      fechaNacimiento: string | null;
      genero: string | null;
      tipoPersona: string;
      activo: boolean;
      ultimaConexion: string | null;
      rolId?: number;
      escuela?: { id: number; nombre: string; nivel: string };
    }>;
  }> {
    const [totalAdministrador, totalDirector, totalMaestro, totalAlumno, totalPadre] =
      await Promise.all([
        this.administradorRepository.count(),
        this.directorRepository.count(),
        this.maestroRepository.count(),
        this.alumnoRepository.count(),
        this.padreRepository.count(),
      ]);

    const total = totalAdministrador + totalDirector + totalMaestro + totalAlumno + totalPadre;

    const personas = await this.personaRepository.find({
      where: [
        { tipoPersona: 'administrador' },
        { tipoPersona: 'director' },
        { tipoPersona: 'maestro' },
        { tipoPersona: 'alumno' },
        { tipoPersona: 'padre' },
      ],
      relations: ['administrador', 'director', 'director.escuela', 'maestro', 'maestro.escuela', 'alumno', 'alumno.escuela', 'padre'],
      select: ['id', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'correo', 'telefono', 'fechaNacimiento', 'genero', 'tipoPersona', 'activo', 'ultimaConexion'],
      order: { tipoPersona: 'ASC', apellidoPaterno: 'ASC', nombre: 'ASC' },
    });

    const data = personas.map(mapPersonaToUsuarioListItem);

    this.logger.log(`Listado de todos los usuarios: ${data.length} total. Admin=${totalAdministrador}, Director=${totalDirector}, Maestro=${totalMaestro}, Alumno=${totalAlumno}, Padre=${totalPadre}`);

    return {
      message: 'Usuarios obtenidos correctamente',
      totalesPorRol: {
        administrador: totalAdministrador,
        director: totalDirector,
        maestro: totalMaestro,
        alumno: totalAlumno,
        padre: totalPadre,
        total,
      },
      total: data.length,
      data,
    };
  }

  /** Tipos de persona considerados "usuarios" del sistema (con login) */
  private static readonly TIPOS_USUARIO = [
    'administrador',
    'director',
    'maestro',
    'alumno',
    'padre',
  ] as const;

  /**
   * Actualizar un usuario por ID (persona). Solo admin.
   * No se puede cambiar el rol (tipoPersona). Solo datos de persona: nombre, apellido, correo, telefono, fechaNacimiento, genero, password, activo.
   */
  async actualizarUsuarioPorId(
    id: number,
    dto: ActualizarUsuarioDto,
    auditContext?: AuditContext,
  ) {
    const persona = await this.personaRepository.findOne({
      where: { id },
      select: ['id', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'correo', 'telefono', 'fechaNacimiento', 'genero', 'tipoPersona', 'activo', 'password'],
    });
    if (!persona) {
      throw new NotFoundException(`No se encontró el usuario con ID ${id}`);
    }
    const tipo = persona.tipoPersona?.toLowerCase();
    if (!tipo || !PersonasService.TIPOS_USUARIO.includes(tipo as (typeof PersonasService.TIPOS_USUARIO)[number])) {
      throw new NotFoundException(`No se encontró el usuario con ID ${id}`);
    }

    // Solo comprobar duplicado si el correo es distinto al actual (si no, es el mismo usuario manteniendo su correo)
    if (dto.correo != null && dto.correo.trim() !== '') {
      const correoTrim = dto.correo.trim();
      const mismoCorreoQueElMio = persona.correo?.toLowerCase() === correoTrim.toLowerCase();
      if (!mismoCorreoQueElMio) {
        const otroConMismoCorreo = await this.personaRepository.findOne({
          where: { correo: correoTrim, id: Not(id) },
          select: ['id'],
        });
        if (otroConMismoCorreo) {
          throw new ConflictException('El correo ya está en uso por otro usuario');
        }
      }
    }

    if (dto.nombre != null) persona.nombre = dto.nombre.trim();
    if (dto.apellidoPaterno != null) persona.apellidoPaterno = dto.apellidoPaterno.trim();
    if (dto.apellidoMaterno != null) persona.apellidoMaterno = dto.apellidoMaterno.trim() || null;
    if (dto.apellido != null) persona.apellidoPaterno = dto.apellido.trim(); // compatibilidad
    if (dto.correo != null) persona.correo = dto.correo.trim() || null;
    if (dto.telefono != null) persona.telefono = dto.telefono.trim() || null;
    if (dto.fechaNacimiento != null) {
      persona.fechaNacimiento = new Date(dto.fechaNacimiento);
    }
    if (dto.genero != null) persona.genero = dto.genero.trim() || null;
    if (dto.activo != null) persona.activo = dto.activo;
    if (dto.password != null && dto.password.trim() !== '') {
      const saltRounds = 10;
      persona.password = await bcrypt.hash(dto.password, saltRounds);
    }

    await this.personaRepository.save(persona);

    this.logger.log(`Usuario actualizado: persona ID ${id} (${persona.tipoPersona})`);

    await this.auditService.log('actualizar_usuario', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `personaId: ${id} | ${persona.correo ?? ''}`,
    });

    const resultado = await this.personaRepository.findOne({
      where: { id },
      relations: ['administrador', 'director', 'director.escuela', 'maestro', 'maestro.escuela', 'alumno', 'alumno.escuela', 'padre'],
      select: ['id', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'correo', 'telefono', 'fechaNacimiento', 'genero', 'tipoPersona', 'activo'],
    });
    return {
      message: 'Usuario actualizado correctamente',
      data: resultado,
    };
  }

  /**
   * Actualizar alumno: datos de persona + grupo (si se envía grupoId).
   * Director: solo alumnos de su escuela. Admin: cualquier alumno.
   */
  async actualizarAlumno(
    alumnoId: number,
    dto: ActualizarUsuarioDto,
    escuelaIdRestriccion: number | undefined,
    auditContext?: AuditContext,
  ) {
    const { data: alumnoData } = await this.obtenerAlumnoPorId(alumnoId, escuelaIdRestriccion);
    const { grupoId, ...dtoPersona } = dto;

    const resultado = await this.actualizarUsuarioPorId(alumnoData.personaId, dtoPersona as ActualizarUsuarioDto, auditContext);

    if (grupoId !== undefined) {
      const alumno = await this.alumnoRepository.findOne({
        where: { id: alumnoId },
        relations: ['persona'],
      });
      if (!alumno) return resultado;
      const escuelaId = Number(alumno.escuelaId);
      if (escuelaIdRestriccion != null && Number(escuelaIdRestriccion) !== escuelaId) {
        throw new ForbiddenException('No puedes modificar alumnos de otra escuela');
      }

      if (grupoId == null) {
        alumno.grupoId = null;
        alumno.grupo = null;
      } else {
        const grupo = await this.grupoRepository.findOne({ where: { id: grupoId } });
        if (!grupo) throw new NotFoundException('Grupo no encontrado');
        if (Number(grupo.escuelaId) !== escuelaId) {
          throw new ForbiddenException('El grupo no pertenece a la escuela del alumno');
        }
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
        relations: ['administrador', 'director', 'director.escuela', 'maestro', 'maestro.escuela', 'alumno', 'alumno.escuela', 'padre'],
        select: ['id', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'correo', 'telefono', 'fechaNacimiento', 'genero', 'tipoPersona', 'activo'],
      });
      return { ...resultado, data: resultadoActualizado };
    }

    return resultado;
  }

  /**
   * Eliminar un usuario por ID (persona). Solo admin.
   * Borra el registro del rol (administrador/director/maestro/alumno/padre) y luego la persona.
   * Si es padre, antes desvincula a los alumnos (padreId = null).
   */
  async eliminarUsuarioPorId(id: number, auditContext?: AuditContext) {
    const persona = await this.personaRepository.findOne({
      where: { id },
      relations: ['administrador', 'director', 'maestro', 'alumno', 'padre'],
      select: ['id', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'correo', 'tipoPersona'],
    });
    if (!persona) {
      throw new NotFoundException(`No se encontró el usuario con ID ${id}`);
    }
    const tipo = persona.tipoPersona?.toLowerCase();
    if (!tipo || !PersonasService.TIPOS_USUARIO.includes(tipo as (typeof PersonasService.TIPOS_USUARIO)[number])) {
      throw new NotFoundException(`No se encontró el usuario con ID ${id}`);
    }

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

    this.logger.log(`Usuario eliminado: persona ID ${id} (${tipo}) - ${persona.correo ?? ''}`);

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

  /**
   * Obtener todos los alumnos (Admin: todos; Director: solo de su escuela)
   * @param escuelaIdFiltro - Filtrar por escuela
   * @param page - Página (1-based). Si no se pasa, devuelve todos.
   * @param limit - Límite por página (default 50). Si no se pasa con page, devuelve todos.
   */
  async obtenerAlumnos(escuelaIdFiltro?: number, page?: number, limit?: number) {
    const qb = this.alumnoRepository
      .createQueryBuilder('alumno')
      .leftJoinAndSelect('alumno.persona', 'persona')
      .leftJoinAndSelect('alumno.escuela', 'escuela')
      .leftJoinAndSelect('alumno.padre', 'padre')
      .leftJoinAndSelect('padre.persona', 'padrePersona')
      .orderBy('alumno.id', 'ASC');

    if (escuelaIdFiltro != null) {
      qb.andWhere('alumno.escuelaId = :escuelaId', {
        escuelaId: escuelaIdFiltro,
      });
    }

    const total = await qb.getCount();

    const pageSafe = page != null && Number.isInteger(Number(page)) ? Math.max(1, Math.min(Number(page), MAX_PAGE_NUMBER)) : undefined;
    const limitSafe = limit != null && Number.isInteger(Number(limit)) ? Math.max(1, Math.min(Number(limit), MAX_PAGE_SIZE)) : undefined;

    if (pageSafe != null && limitSafe != null) {
      qb.skip((pageSafe - 1) * limitSafe).take(limitSafe);
    }

    const alumnos = await qb.getMany();
    const data = alumnos.map((a) => this.formatearAlumnoConPadre(a));

    const meta =
      pageSafe != null && limitSafe != null
        ? { page: pageSafe, limit: limitSafe, total, totalPages: Math.ceil(total / limitSafe) }
        : undefined;

    return {
      message: 'Alumnos obtenidos exitosamente',
      description: `Se encontraron ${data.length} alumno(s)`,
      total,
      ...(meta && { meta }),
      data,
    };
  }

  /** Campos permitidos para buscar alumnos (evita inyección) */
  private static readonly CAMPOS_BUSCAR_ALUMNO = [
    'nombre',
    'apellidoPaterno',
    'apellidoMaterno',
    'correo',
    'telefono',
    'grado',
    'grupo',
    'cicloEscolar',
    'escuelaId',
  ] as const;

  /**
   * Buscar alumnos por un solo campo. Búsqueda global: sin paginación.
   * Admin: todos los que coincidan. Director: solo los de su escuela (escuelaIdFiltro).
   * @param campo - nombre, apellidoPaterno, apellidoMaterno, correo, telefono, grado, grupo, cicloEscolar, escuelaId
   * @param valor - valor a buscar (texto con LIKE %valor% o número exacto según el campo)
   */
  async buscarAlumnos(campo: string, valor: string, escuelaIdFiltro?: number) {
    const campoTrim = String(campo ?? '').trim();
    if (campoTrim.length > 50) {
      throw new BadRequestException('El nombre del campo de búsqueda no es válido.');
    }
    const campoNormalizado = campoTrim.toLowerCase();
    if (!PersonasService.CAMPOS_BUSCAR_ALUMNO.includes(campoNormalizado as (typeof PersonasService.CAMPOS_BUSCAR_ALUMNO)[number])) {
      throw new BadRequestException(
        `Campo de búsqueda no permitido. Use uno de: ${PersonasService.CAMPOS_BUSCAR_ALUMNO.join(', ')}`,
      );
    }
    if (valor == null || String(valor).trim() === '') {
      throw new BadRequestException('El valor de búsqueda no puede estar vacío.');
    }
    const valorTrim = String(valor).trim();
    if (valorTrim.length > 200) {
      throw new BadRequestException('El valor de búsqueda no puede superar 200 caracteres.');
    }

    const qb = this.alumnoRepository
      .createQueryBuilder('alumno')
      .leftJoinAndSelect('alumno.persona', 'persona')
      .leftJoinAndSelect('alumno.escuela', 'escuela')
      .leftJoinAndSelect('alumno.padre', 'padre')
      .leftJoinAndSelect('padre.persona', 'padrePersona')
      .orderBy('alumno.id', 'ASC');

    if (escuelaIdFiltro != null) {
      qb.andWhere('alumno.escuelaId = :escuelaId', { escuelaId: escuelaIdFiltro });
    }

    const camposTextoPersona = ['nombre', 'apellidoPaterno', 'apellidoMaterno', 'correo', 'telefono'];
    const camposTextoAlumno = ['grupo', 'cicloEscolar'];
    const camposNumero = ['grado', 'escuelaId'];

    if (camposTextoPersona.includes(campoNormalizado)) {
      qb.andWhere(`persona.${campoNormalizado} LIKE :valorBuscar`, {
        valorBuscar: `%${valorTrim}%`,
      });
    } else if (camposTextoAlumno.includes(campoNormalizado)) {
      qb.andWhere(`alumno.${campoNormalizado} LIKE :valorBuscar`, {
        valorBuscar: `%${valorTrim}%`,
      });
    } else if (camposNumero.includes(campoNormalizado)) {
      const num = parseInt(valorTrim, 10);
      if (Number.isNaN(num)) {
        throw new BadRequestException(`El campo "${campo}" requiere un número.`);
      }
      qb.andWhere(`alumno.${campoNormalizado} = :valorNum`, { valorNum: num });
    }

    const alumnos = await qb.getMany();
    const data = alumnos.map((a) => this.formatearAlumnoConPadre(a));

    return {
      message: 'Búsqueda de alumnos realizada',
      description: `Se encontraron ${data.length} alumno(s) con ${campo}=${valorTrim}`,
      total: data.length,
      data,
    };
  }

  /**
   * Obtener un alumno por ID (alumno) o por personaId.
   * Acepta ambos para evitar confusión: el frontend puede enviar id de alumno o id de persona.
   * @param escuelaIdRestriccion - Si se pasa, solo se devuelve si el alumno pertenece a esa escuela (para directores)
   */
  async obtenerAlumnoPorId(id: number, escuelaIdRestriccion?: number) {
    let alumno = await this.alumnoRepository.findOne({
      where: { id },
      relations: ['persona', 'escuela', 'padre', 'padre.persona'],
    });
    if (!alumno) {
      alumno = await this.alumnoRepository.findOne({
        where: { personaId: id },
        relations: ['persona', 'escuela', 'padre', 'padre.persona'],
      });
    }
    if (!alumno) {
      throw new NotFoundException(`No se encontró el alumno (ID alumno o persona: ${id})`);
    }
    if (escuelaIdRestriccion != null && Number(alumno.escuelaId) !== Number(escuelaIdRestriccion)) {
      throw new NotFoundException(
        `El alumno (ID ${alumno.id}) no pertenece a tu escuela (solo puedes ver alumnos de tu centro)`,
      );
    }

    const codigoVinculacionActivo = await this.alumnoVinculacionPadreRepository.findOne({
      where: {
        alumnoId: alumno.id,
        usado: false,
      },
      order: { creadoEn: 'DESC' },
    });

    return {
      message: 'Alumno obtenido exitosamente',
      description: 'Alumno encontrado en el sistema',
      data: {
        ...this.formatearAlumnoConPadre(alumno),
        codigoVinculacion: codigoVinculacionActivo?.codigo ?? null,
        codigoVinculacionExpiraEn: codigoVinculacionActivo?.expiraEn ?? null,
      },
    };
  }

  /**
   * Obtener el código de vinculación activo del alumno.
   * - Si no existe un registro activo (legacy), lo genera en ese momento.
   * - :id puede ser id de Alumno o id de Persona (compatibilidad con frontend).
   */
  async obtenerCodigoVinculacionAlumno(id: number): Promise<{
    message: string;
    description: string;
    data: {
      codigo: string;
      expiraEn: Date | null;
      usado: boolean;
    };
  }> {
    return await this.dataSource.transaction(async (manager) => {
      const alumnoRepo = manager.getRepository(Alumno);
      const alumnoVinculacionRepo = manager.getRepository(AlumnoVinculacionPadre);

      let alumno = await alumnoRepo.findOne({
        where: { id },
        select: ['id', 'personaId', 'escuelaId'],
      });

      // Compatibilidad: el frontend podría mandar id de persona en vez de id de alumno.
      if (!alumno) {
        alumno = await alumnoRepo.findOne({
          where: { personaId: id },
          select: ['id', 'personaId', 'escuelaId'],
        });
      }

      if (!alumno) {
        throw new NotFoundException(`No se encontró el alumno (ID alumno o persona: ${id})`);
      }

      const ahora = new Date();
      const codigoActivo = await alumnoVinculacionRepo.findOne({
        where: { alumnoId: alumno.id, usado: false },
        order: { creadoEn: 'DESC' },
      });

      const esVigente =
        !!codigoActivo &&
        (!codigoActivo.expiraEn || codigoActivo.expiraEn.getTime() >= ahora.getTime());

      const vinculoFinal = esVigente
        ? codigoActivo!
        : await this.crearCodigoVinculacionParaAlumnoTransactional(alumno.id, alumnoVinculacionRepo);

      return {
        message: 'Código de vinculación obtenido correctamente',
        description: 'El código de vinculación del alumno fue validado',
        data: {
          codigo: vinculoFinal.codigo,
          expiraEn: vinculoFinal.expiraEn,
          usado: vinculoFinal.usado,
        },
      };
    });
  }

  /**
   * Obtener el código de vinculación para un Padre/Tutor.
   * Nota: si el padre tiene múltiples alumnos, se devuelve el más "reciente" (por id) que esté activo.
   */
  async obtenerCodigoVinculacionParaPadre(padreId: number): Promise<{
    message: string;
    description: string;
    data: {
      codigo: string;
      expiraEn: Date | null;
      usado: boolean;
    };
  }> {
    // No usamos transacción aquí porque delegamos en `obtenerCodigoVinculacionAlumno`.
    const padre = await this.padreRepository.findOne({
      where: { id: padreId },
      relations: ['alumnos'],
    });

    if (!padre) {
      throw new NotFoundException(`No se encontró el padre con ID ${padreId}`);
    }

    const alumnos = (padre.alumnos ?? []).filter((a) => a && a.activo);
    if (alumnos.length === 0) {
      throw new NotFoundException('El padre no tiene alumnos activos asociados');
    }

    const alumnoSeleccionado = alumnos.sort((a, b) => Number(b.id) - Number(a.id))[0];
    return await this.obtenerCodigoVinculacionAlumno(Number(alumnoSeleccionado.id));
  }

  /**
   * Obtener un maestro por ID (maestro) o por personaId.
   * Acepta ambos para evitar confusión: el frontend puede enviar id de maestro o id de persona.
   * @param escuelaIdRestriccion - Si se pasa, solo se devuelve si el maestro pertenece a esa escuela (para directores)
   */
  async obtenerMaestroPorId(id: number, escuelaIdRestriccion?: number) {
    let maestro = await this.maestroRepository.findOne({
      where: { id },
      relations: ['persona', 'escuela'],
    });
    if (!maestro) {
      maestro = await this.maestroRepository.findOne({
        where: { personaId: id },
        relations: ['persona', 'escuela'],
      });
    }
    if (!maestro) {
      throw new NotFoundException(`No se encontró el maestro (ID maestro o persona: ${id})`);
    }
    if (escuelaIdRestriccion != null && Number(maestro.escuelaId) !== Number(escuelaIdRestriccion)) {
      throw new NotFoundException(
        `El maestro (ID ${maestro.id}) no pertenece a tu escuela (solo puedes ver maestros de tu centro)`,
      );
    }
    return {
      message: 'Maestro obtenido exitosamente',
      description: 'Maestro encontrado en el sistema',
      data: this.formatearMaestro(maestro),
    };
  }

  /**
   * Obtener el padre de un alumno (si tiene)
   * @param escuelaIdRestriccion - Si se pasa, solo se devuelve si el alumno pertenece a esa escuela (para directores)
   */
  async obtenerPadreDeAlumno(alumnoId: number, escuelaIdRestriccion?: number) {
    const alumno = await this.alumnoRepository.findOne({
      where: { id: alumnoId },
      relations: ['padre', 'padre.persona', 'persona'],
    });
    if (!alumno) {
      throw new NotFoundException(`No se encontró el alumno con ID ${alumnoId}`);
    }
    if (escuelaIdRestriccion != null && Number(alumno.escuelaId) !== Number(escuelaIdRestriccion)) {
      throw new NotFoundException(
        `El alumno con ID ${alumnoId} no pertenece a tu escuela (solo puedes ver alumnos de tu centro)`,
      );
    }
    if (!alumno.padre) {
      return {
        message: 'Alumno sin padre asignado',
        description: 'Este alumno no tiene un padre/tutor registrado en el sistema',
        data: null,
      };
    }
    return {
      message: 'Padre del alumno obtenido exitosamente',
      description: `Padre/tutor de ${alumno.persona?.nombre ?? 'el alumno'}`,
      data: {
        id: alumno.padre.id,
        parentesco: alumno.padre.parentesco,
        persona: alumno.padre.persona
          ? {
              id: alumno.padre.persona.id,
              nombre: alumno.padre.persona.nombre,
              apellidoPaterno: alumno.padre.persona.apellidoPaterno,
              apellidoMaterno: alumno.padre.persona.apellidoMaterno ?? null,
              correo: alumno.padre.persona.correo,
              telefono: alumno.padre.persona.telefono,
              genero: alumno.padre.persona.genero ?? null,
            }
          : null,
      },
    };
  }

  /**
   * Obtener todos los padres
   * @param page - Página (1-based). Si no se pasa, devuelve todos.
   * @param limit - Límite por página (default 50). Si no se pasa con page, devuelve todos.
   */
  async obtenerPadres(page?: number, limit?: number) {
    const qb = this.padreRepository
      .createQueryBuilder('padre')
      .leftJoinAndSelect('padre.persona', 'persona')
      .leftJoinAndSelect('padre.alumnos', 'alumnos')
      .leftJoinAndSelect('alumnos.persona', 'alumnosPersona')
      .leftJoinAndSelect('alumnos.escuela', 'alumnosEscuela')
      .orderBy('padre.id', 'ASC');

    const total = await qb.getCount();

    const pageSafe = page != null && Number.isInteger(Number(page)) ? Math.max(1, Math.min(Number(page), MAX_PAGE_NUMBER)) : undefined;
    const limitSafe = limit != null && Number.isInteger(Number(limit)) ? Math.max(1, Math.min(Number(limit), MAX_PAGE_SIZE)) : undefined;

    if (pageSafe != null && limitSafe != null) {
      qb.skip((pageSafe - 1) * limitSafe).take(limitSafe);
    }

    const padres = await qb.getMany();
    const data = padres.map((p) => this.formatearPadreConAlumnos(p));

    const meta =
      pageSafe != null && limitSafe != null
        ? { page: pageSafe, limit: limitSafe, total, totalPages: Math.ceil(total / limitSafe) }
        : undefined;

    return {
      message: 'Padres obtenidos exitosamente',
      description: `Se encontraron ${data.length} padre(s)/tutor(es) en el sistema`,
      total,
      ...(meta && { meta }),
      data,
    };
  }

  /**
   * Obtener un padre por ID con sus alumnos
   */
  async obtenerPadrePorId(id: number) {
    const padre = await this.padreRepository.findOne({
      where: { id },
      relations: ['persona', 'alumnos', 'alumnos.persona', 'alumnos.escuela'],
    });
    if (!padre) {
      throw new NotFoundException(`No se encontró el padre con ID ${id}`);
    }
    return {
      message: 'Padre obtenido exitosamente',
      description: 'Padre/tutor encontrado en el sistema',
      data: this.formatearPadreConAlumnos(padre),
    };
  }

  /**
   * Obtener los alumnos (hijos) de un padre
   */
  async obtenerAlumnosDePadre(padreId: number) {
    const padre = await this.padreRepository.findOne({
      where: { id: padreId },
      relations: ['persona', 'alumnos', 'alumnos.persona', 'alumnos.escuela'],
    });
    if (!padre) {
      throw new NotFoundException(`No se encontró el padre con ID ${padreId}`);
    }
    const alumnos = (padre.alumnos || []).map((a) => this.formatearAlumnoParaLista(a));
    return {
      message: 'Alumnos del padre obtenidos exitosamente',
      description: `${padre.persona?.nombre ?? 'Este padre'} tiene ${alumnos.length} hijo(s) registrado(s)`,
      total: alumnos.length,
      data: alumnos,
    };
  }

  /**
   * Vincular un alumno a un padre mediante un código de un solo uso.
   * El padre se obtiene del usuario autenticado.
   */
  async vincularAlumnoConPadrePorCodigo(padreId: number, codigo: string) {
    const ahora = new Date();

    const vinculo = await this.alumnoVinculacionPadreRepository.findOne({
      where: { codigo, usado: false },
      order: { creadoEn: 'DESC' },
    });

    if (!vinculo) {
      throw new BadRequestException('Código inválido o ya utilizado');
    }

    if (vinculo.expiraEn && vinculo.expiraEn.getTime() < ahora.getTime()) {
      throw new BadRequestException('El código ha expirado, solicita uno nuevo en la escuela');
    }

    const alumno = await this.alumnoRepository.findOne({
      where: { id: vinculo.alumnoId },
    });
    if (!alumno) {
      throw new NotFoundException('El alumno asociado a este código ya no existe');
    }

    // Vincular padre–alumno (one-to-many por el campo padreId existente)
    alumno.padreId = padreId;
    await this.alumnoRepository.save(alumno);

    vinculo.usado = true;
    vinculo.usadoEn = ahora;
    await this.alumnoVinculacionPadreRepository.save(vinculo);

    return {
      message: 'Alumno vinculado correctamente al padre',
      description: 'El código ha sido validado y ya no podrá volver a utilizarse.',
      data: {
        alumnoId: alumno.id,
        padreId,
      },
    };
  }

  /**
   * Desvincular un alumno del padre/tutor.
   * Solo el tutor que tiene vinculado al alumno puede desvincularlo.
   */
  async desvincularAlumnoDelPadre(padreId: number, alumnoId: number) {
    const alumno = await this.alumnoRepository.findOne({
      where: { id: alumnoId },
    });

    if (!alumno) {
      throw new NotFoundException('Alumno no encontrado');
    }

    if (alumno.padreId !== padreId) {
      throw new ForbiddenException(
        'Solo puedes desvincular alumnos que están vinculados a tu cuenta',
      );
    }

    alumno.padreId = null;
    await this.alumnoRepository.save(alumno);

    return {
      message: 'Alumno desvinculado correctamente',
      description: 'El alumno ya no está asociado a tu cuenta como tutor.',
      data: {
        alumnoId: alumno.id,
      },
    };
  }

  private formatearAlumnoConPadre(alumno: any) {
    return {
      id: alumno.id,
      personaId: alumno.personaId,
      escuelaId: alumno.escuelaId,
      padreId: alumno.padreId ?? null,
      grado: alumno.grado,
      grupo: alumno.grupo,
      grupoId: alumno.grupoId ?? null,
      cicloEscolar: alumno.cicloEscolar,
      persona: alumno.persona
        ? {
            id: alumno.persona.id,
            nombre: alumno.persona.nombre,
            apellidoPaterno: alumno.persona.apellidoPaterno,
            apellidoMaterno: alumno.persona.apellidoMaterno ?? null,
            correo: alumno.persona.correo,
            telefono: alumno.persona.telefono,
            genero: alumno.persona.genero ?? null,
          }
        : null,
      escuela: alumno.escuela
        ? { id: alumno.escuela.id, nombre: alumno.escuela.nombre, nivel: alumno.escuela.nivel }
        : null,
      padre: alumno.padre
        ? {
            id: alumno.padre.id,
            parentesco: alumno.padre.parentesco,
            persona: alumno.padre.persona
              ? {
                  id: alumno.padre.persona.id,
                  nombre: alumno.padre.persona.nombre,
                  apellidoPaterno: alumno.padre.persona.apellidoPaterno,
                  apellidoMaterno: alumno.padre.persona.apellidoMaterno ?? null,
                  correo: alumno.padre.persona.correo,
                  telefono: alumno.padre.persona.telefono,
                  genero: alumno.padre.persona.genero ?? null,
                }
              : null,
          }
        : null,
    };
  }

  private formatearAlumnoParaLista(alumno: any) {
    return {
      id: alumno.id,
      personaId: alumno.personaId,
      escuelaId: alumno.escuelaId,
      grado: alumno.grado,
      grupo: alumno.grupo,
      grupoId: alumno.grupoId ?? null,
      cicloEscolar: alumno.cicloEscolar,
      persona: alumno.persona
        ? {
            id: alumno.persona.id,
            nombre: alumno.persona.nombre,
            apellidoPaterno: alumno.persona.apellidoPaterno,
            apellidoMaterno: alumno.persona.apellidoMaterno ?? null,
            correo: alumno.persona.correo,
            telefono: alumno.persona.telefono,
            genero: alumno.persona.genero ?? null,
          }
        : null,
      escuela: alumno.escuela
        ? { id: alumno.escuela.id, nombre: alumno.escuela.nombre }
        : null,
    };
  }

  private formatearPadreConAlumnos(padre: any) {
    const correo = padre.persona?.correo || '';
    const pendiente = correo.includes('@temp.local');
    return {
      id: padre.id,
      personaId: padre.personaId,
      parentesco: padre.parentesco,
      pendiente,
      persona: padre.persona
        ? {
            id: padre.persona.id,
            nombre: padre.persona.nombre,
            apellidoPaterno: padre.persona.apellidoPaterno,
            apellidoMaterno: padre.persona.apellidoMaterno ?? null,
            correo: padre.persona.correo,
            telefono: padre.persona.telefono,
            genero: padre.persona.genero ?? null,
          }
        : null,
      cantidadHijos: (padre.alumnos || []).length,
      alumnos: (padre.alumnos || []).map((a) => this.formatearAlumnoParaLista(a)),
    };
  }

  private formatearMaestro(maestro: any) {
    return {
      id: maestro.id,
      personaId: maestro.personaId,
      escuelaId: maestro.escuelaId,
      especialidad: maestro.especialidad ?? null,
      fechaContratacion: maestro.fechaContratacion ?? null,
      activo: maestro.activo ?? true,
      persona: maestro.persona
        ? {
            id: maestro.persona.id,
            nombre: maestro.persona.nombre,
            apellidoPaterno: maestro.persona.apellidoPaterno,
            apellidoMaterno: maestro.persona.apellidoMaterno ?? null,
            correo: maestro.persona.correo,
            telefono: maestro.persona.telefono,
            genero: maestro.persona.genero ?? null,
          }
        : null,
      escuela: maestro.escuela
        ? {
            id: maestro.escuela.id,
            nombre: maestro.escuela.nombre,
            nivel: maestro.escuela.nivel,
          }
        : null,
    };
  }
}
