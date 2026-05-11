import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Persona } from '../entities/persona.entity';
import { Padre } from '../entities/padre.entity';
import { Alumno } from '../entities/alumno.entity';
import { Maestro } from '../entities/maestro.entity';
import { AlumnoVinculacionPadre } from '../entities/alumno-vinculacion-padre.entity';
import { MAX_PAGE_SIZE, MAX_PAGE_NUMBER } from '../../common/constants/validation.constants';
import {
  formatearAlumnoConPadre,
  formatearAlumnoParaLista,
  formatearPadreConAlumnos,
  formatearMaestro,
} from '../mappers/persona-formatters';
import { mapPersonaToUsuarioListItem } from '../mappers/usuario.mapper';

@Injectable()
export class ConsultaPersonasService {
  private readonly logger = new Logger(ConsultaPersonasService.name);

  constructor(
    @InjectRepository(Persona)
    private readonly personaRepository: Repository<Persona>,
    @InjectRepository(Padre)
    private readonly padreRepository: Repository<Padre>,
    @InjectRepository(Alumno)
    private readonly alumnoRepository: Repository<Alumno>,
    @InjectRepository(Maestro)
    private readonly maestroRepository: Repository<Maestro>,
    @InjectRepository(AlumnoVinculacionPadre)
    private readonly alumnoVinculacionPadreRepository: Repository<AlumnoVinculacionPadre>,
  ) {}

  async obtenerAdmins() {
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

    return {
      message: 'Administradores obtenidos exitosamente',
      description: `Se encontraron ${admins.length} administrador(es)`,
      total: admins.length,
      data: admins,
    };
  }

  async contarAdmins(): Promise<number> {
    return await this.personaRepository
      .createQueryBuilder('persona')
      .innerJoin('persona.administrador', 'administrador')
      .getCount();
  }

  async obtenerAlumnos(escuelaIdFiltro?: number, page?: number, limit?: number) {
    const qb = this.alumnoRepository
      .createQueryBuilder('alumno')
      .leftJoinAndSelect('alumno.persona', 'persona')
      .leftJoinAndSelect('alumno.escuela', 'escuela')
      .leftJoinAndSelect('alumno.padre', 'padre')
      .leftJoinAndSelect('padre.persona', 'padrePersona')
      .orderBy('alumno.id', 'ASC');

    if (escuelaIdFiltro != null)
      qb.andWhere('alumno.escuelaId = :escuelaId', { escuelaId: escuelaIdFiltro });

    const total = await qb.getCount();
    const pageSafe =
      page != null && Number.isInteger(Number(page))
        ? Math.max(1, Math.min(Number(page), MAX_PAGE_NUMBER))
        : undefined;
    const limitSafe =
      limit != null && Number.isInteger(Number(limit))
        ? Math.max(1, Math.min(Number(limit), MAX_PAGE_SIZE))
        : undefined;

    if (pageSafe != null && limitSafe != null) qb.skip((pageSafe - 1) * limitSafe).take(limitSafe);

    const alumnos = await qb.getMany();
    const data = alumnos.map(formatearAlumnoConPadre);
    const meta =
      pageSafe != null && limitSafe != null
        ? { page: pageSafe, limit: limitSafe, total, totalPages: Math.ceil(total / limitSafe) }
        : undefined;

    return { message: 'Alumnos obtenidos', total, ...(meta && { meta }), data };
  }

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

  async buscarAlumnos(campo: string, valor: string, escuelaIdFiltro?: number) {
    const campoNormalizado = String(campo || '')
      .trim()
      .toLowerCase();
    if (!ConsultaPersonasService.CAMPOS_BUSCAR_ALUMNO.includes(campoNormalizado as any))
      throw new BadRequestException('Campo inválido');
    if (!valor || !String(valor).trim()) throw new BadRequestException('Valor vacío');

    const valorTrim = String(valor).trim();
    const qb = this.alumnoRepository
      .createQueryBuilder('alumno')
      .leftJoinAndSelect('alumno.persona', 'persona')
      .leftJoinAndSelect('alumno.escuela', 'escuela')
      .leftJoinAndSelect('alumno.padre', 'padre')
      .leftJoinAndSelect('padre.persona', 'padrePersona')
      .orderBy('alumno.id', 'ASC');

    if (escuelaIdFiltro != null)
      qb.andWhere('alumno.escuelaId = :escuelaId', { escuelaId: escuelaIdFiltro });

    if (
      ['nombre', 'apellidoPaterno', 'apellidoMaterno', 'correo', 'telefono'].includes(
        campoNormalizado,
      )
    ) {
      qb.andWhere(`persona.${campoNormalizado} LIKE :valor`, { valor: `%${valorTrim}%` });
    } else if (['grupo', 'cicloEscolar'].includes(campoNormalizado)) {
      qb.andWhere(`alumno.${campoNormalizado} LIKE :valor`, { valor: `%${valorTrim}%` });
    } else {
      const num = parseInt(valorTrim, 10);
      if (isNaN(num)) throw new BadRequestException('Requiere un número');
      qb.andWhere(`alumno.${campoNormalizado} = :num`, { num });
    }

    const data = (await qb.getMany()).map(formatearAlumnoConPadre);
    return { message: 'Búsqueda realizada', total: data.length, data };
  }

  async obtenerAlumnoPorId(id: number, escuelaIdRestriccion?: number) {
    let alumno = await this.alumnoRepository.findOne({
      where: { id },
      relations: ['persona', 'escuela', 'padre', 'padre.persona'],
    });
    if (!alumno)
      alumno = await this.alumnoRepository.findOne({
        where: { personaId: id },
        relations: ['persona', 'escuela', 'padre', 'padre.persona'],
      });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    if (escuelaIdRestriccion != null && Number(alumno.escuelaId) !== Number(escuelaIdRestriccion))
      throw new NotFoundException('No pertenece a tu escuela');

    const codigo = await this.alumnoVinculacionPadreRepository.findOne({
      where: { alumnoId: alumno.id, usado: false },
      order: { creadoEn: 'DESC' },
    });

    return {
      message: 'Alumno obtenido',
      data: {
        ...formatearAlumnoConPadre(alumno),
        codigoVinculacion: codigo?.codigo ?? null,
        codigoVinculacionExpiraEn: codigo?.expiraEn ?? null,
      },
    };
  }

  async obtenerMaestroPorId(id: number, escuelaIdRestriccion?: number) {
    let maestro = await this.maestroRepository.findOne({
      where: { id },
      relations: ['persona', 'escuela'],
    });
    if (!maestro)
      maestro = await this.maestroRepository.findOne({
        where: { personaId: id },
        relations: ['persona', 'escuela'],
      });
    if (!maestro) throw new NotFoundException('Maestro no encontrado');
    if (escuelaIdRestriccion != null && Number(maestro.escuelaId) !== Number(escuelaIdRestriccion))
      throw new NotFoundException('No pertenece a tu escuela');

    return { message: 'Maestro obtenido', data: formatearMaestro(maestro) };
  }

  async obtenerPadreDeAlumno(alumnoId: number, escuelaIdRestriccion?: number) {
    const alumno = await this.alumnoRepository.findOne({
      where: { id: alumnoId },
      relations: ['padre', 'padre.persona', 'persona'],
    });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    if (escuelaIdRestriccion != null && Number(alumno.escuelaId) !== Number(escuelaIdRestriccion))
      throw new NotFoundException('No pertenece a tu escuela');
    if (!alumno.padre) return { message: 'Sin padre asignado', data: null };

    return {
      message: 'Padre obtenido',
      data: {
        id: alumno.padre.id,
        parentesco: alumno.padre.parentesco,
        persona: alumno.padre.persona,
      },
    };
  }

  async obtenerPadres(page?: number, limit?: number) {
    const qb = this.padreRepository
      .createQueryBuilder('padre')
      .leftJoinAndSelect('padre.persona', 'persona')
      .leftJoinAndSelect('padre.alumnos', 'alumnos')
      .leftJoinAndSelect('alumnos.persona', 'alumnosPersona')
      .leftJoinAndSelect('alumnos.escuela', 'alumnosEscuela')
      .orderBy('padre.id', 'ASC');

    const total = await qb.getCount();
    const pageSafe =
      page != null && Number.isInteger(Number(page))
        ? Math.max(1, Math.min(Number(page), MAX_PAGE_NUMBER))
        : undefined;
    const limitSafe =
      limit != null && Number.isInteger(Number(limit))
        ? Math.max(1, Math.min(Number(limit), MAX_PAGE_SIZE))
        : undefined;

    if (pageSafe != null && limitSafe != null) qb.skip((pageSafe - 1) * limitSafe).take(limitSafe);

    const padres = await qb.getMany();
    const meta =
      pageSafe != null && limitSafe != null
        ? { page: pageSafe, limit: limitSafe, total, totalPages: Math.ceil(total / limitSafe) }
        : undefined;

    return {
      message: 'Padres obtenidos',
      total,
      ...(meta && { meta }),
      data: padres.map(formatearPadreConAlumnos),
    };
  }

  async obtenerPadrePorId(id: number) {
    const padre = await this.padreRepository.findOne({
      where: { id },
      relations: ['persona', 'alumnos', 'alumnos.persona', 'alumnos.escuela'],
    });
    if (!padre) throw new NotFoundException('Padre no encontrado');
    return { message: 'Padre obtenido', data: formatearPadreConAlumnos(padre) };
  }

  async obtenerAlumnosDePadre(padreId: number) {
    const padre = await this.padreRepository.findOne({
      where: { id: padreId },
      relations: ['persona', 'alumnos', 'alumnos.persona', 'alumnos.escuela'],
    });
    if (!padre) throw new NotFoundException('Padre no encontrado');
    const alumnos = (padre.alumnos || []).map(formatearAlumnoParaLista);
    return { message: 'Alumnos obtenidos', total: alumnos.length, data: alumnos };
  }

  async obtenerTodosUsuariosConTotales() {
    const personas = await this.personaRepository.find({
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
      order: { id: 'DESC' },
    });

    const data = personas.map(mapPersonaToUsuarioListItem);
    const totalesBase = data.reduce<Record<string, number>>((acc, usuario) => {
      const tipo = usuario.tipoPersona || 'desconocido';
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {});
    const total = data.length;

    return {
      message: 'Usuarios obtenidos exitosamente',
      totalesPorRol: {
        administrador: totalesBase.administrador || 0,
        director: totalesBase.director || 0,
        maestro: totalesBase.maestro || 0,
        alumno: totalesBase.alumno || 0,
        padre: totalesBase.padre || 0,
        total,
      },
      total,
      data,
    };
  }
}
