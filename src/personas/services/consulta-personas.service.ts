import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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

  constructor(private readonly prisma: PrismaService) {}

  async obtenerAdmins() {
    const admins = await this.prisma.persona.findMany({
      where: { administrador: { isNot: null } },
      include: { administrador: true },
    });

    return {
      message: 'Administradores obtenidos exitosamente',
      description: `Se encontraron ${admins.length} administrador(es)`,
      total: admins.length,
      data: admins,
    };
  }

  async contarAdmins(): Promise<number> {
    return this.prisma.persona.count({ where: { administrador: { isNot: null } } });
  }

  async obtenerAlumnos(escuelaIdFiltro?: number, page?: number, limit?: number) {
    const where = escuelaIdFiltro != null ? { escuelaId: BigInt(escuelaIdFiltro) } : {};

    const total = await this.prisma.alumno.count({ where });

    const pageSafe =
      page != null && Number.isInteger(Number(page))
        ? Math.max(1, Math.min(Number(page), MAX_PAGE_NUMBER))
        : undefined;
    const limitSafe =
      limit != null && Number.isInteger(Number(limit))
        ? Math.max(1, Math.min(Number(limit), MAX_PAGE_SIZE))
        : undefined;

    const alumnos = await this.prisma.alumno.findMany({
      where,
      include: {
        persona: true,
        escuela: true,
        padre: { include: { persona: true } },
      },
      orderBy: { id: 'asc' },
      ...(pageSafe != null && limitSafe != null
        ? { skip: (pageSafe - 1) * limitSafe, take: limitSafe }
        : {}),
    });

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
    const campoNormalizado = String(campo || '').trim().toLowerCase();
    if (!ConsultaPersonasService.CAMPOS_BUSCAR_ALUMNO.includes(campoNormalizado as any))
      throw new BadRequestException('Campo inválido');
    if (!valor || !String(valor).trim()) throw new BadRequestException('Valor vacío');

    const valorTrim = String(valor).trim();
    const baseWhere: any = {};
    if (escuelaIdFiltro != null) baseWhere.escuelaId = BigInt(escuelaIdFiltro);

    const personaFields = ['nombre', 'apellidoPaterno', 'apellidoMaterno', 'correo', 'telefono'];
    const alumnoStringFields = ['grupo', 'cicloEscolar'];
    const alumnoNumericFields = ['grado', 'escuelaId'];

    let where: any = { ...baseWhere };

    if (personaFields.includes(campoNormalizado)) {
      where.persona = { [campoNormalizado]: { contains: valorTrim } };
    } else if (alumnoStringFields.includes(campoNormalizado)) {
      where[campoNormalizado] = { contains: valorTrim };
    } else if (alumnoNumericFields.includes(campoNormalizado)) {
      const num = parseInt(valorTrim, 10);
      if (isNaN(num)) throw new BadRequestException('Requiere un número');
      where[campoNormalizado] = BigInt(num);
    }

    const alumnos = await this.prisma.alumno.findMany({
      where,
      include: {
        persona: true,
        escuela: true,
        padre: { include: { persona: true } },
      },
      orderBy: { id: 'asc' },
    });

    const data = alumnos.map(formatearAlumnoConPadre);
    return { message: 'Búsqueda realizada', total: data.length, data };
  }

  async obtenerAlumnoPorId(id: number, escuelaIdRestriccion?: number) {
    const include = {
      persona: true,
      escuela: true,
      padre: { include: { persona: true } },
    };

    let alumno = await this.prisma.alumno.findUnique({ where: { id: BigInt(id) }, include });
    if (!alumno) alumno = await this.prisma.alumno.findUnique({ where: { personaId: BigInt(id) }, include });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    if (escuelaIdRestriccion != null && Number(alumno.escuelaId) !== Number(escuelaIdRestriccion))
      throw new NotFoundException('No pertenece a tu escuela');

    const codigo = await this.prisma.alumnoVinculacionPadre.findFirst({
      where: { alumnoId: alumno.id, usado: false },
      orderBy: { creadoEn: 'desc' },
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
    const include = { persona: true, escuela: true };

    let maestro = await this.prisma.maestro.findUnique({ where: { id: BigInt(id) }, include });
    if (!maestro) maestro = await this.prisma.maestro.findUnique({ where: { personaId: BigInt(id) }, include });
    if (!maestro) throw new NotFoundException('Maestro no encontrado');
    if (escuelaIdRestriccion != null && Number(maestro.escuelaId) !== Number(escuelaIdRestriccion))
      throw new NotFoundException('No pertenece a tu escuela');

    return { message: 'Maestro obtenido', data: formatearMaestro(maestro) };
  }

  async obtenerPadreDeAlumno(alumnoId: number, escuelaIdRestriccion?: number) {
    const alumno = await this.prisma.alumno.findUnique({
      where: { id: BigInt(alumnoId) },
      include: { padre: { include: { persona: true } }, persona: true },
    });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    if (escuelaIdRestriccion != null && Number(alumno.escuelaId) !== Number(escuelaIdRestriccion))
      throw new NotFoundException('No pertenece a tu escuela');
    if (!alumno.padre) return { message: 'Sin padre asignado', data: null };

    return {
      message: 'Padre obtenido',
      data: {
        id: Number(alumno.padre.id),
        parentesco: alumno.padre.parentesco,
        persona: alumno.padre.persona,
      },
    };
  }

  async obtenerPadres(page?: number, limit?: number) {
    const total = await this.prisma.padre.count();

    const pageSafe =
      page != null && Number.isInteger(Number(page))
        ? Math.max(1, Math.min(Number(page), MAX_PAGE_NUMBER))
        : undefined;
    const limitSafe =
      limit != null && Number.isInteger(Number(limit))
        ? Math.max(1, Math.min(Number(limit), MAX_PAGE_SIZE))
        : undefined;

    const padres = await this.prisma.padre.findMany({
      include: {
        persona: true,
        alumnos: { include: { persona: true, escuela: true } },
      },
      orderBy: { id: 'asc' },
      ...(pageSafe != null && limitSafe != null
        ? { skip: (pageSafe - 1) * limitSafe, take: limitSafe }
        : {}),
    });

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
    const padre = await this.prisma.padre.findUnique({
      where: { id: BigInt(id) },
      include: { persona: true, alumnos: { include: { persona: true, escuela: true } } },
    });
    if (!padre) throw new NotFoundException('Padre no encontrado');
    return { message: 'Padre obtenido', data: formatearPadreConAlumnos(padre) };
  }

  async obtenerAlumnosDePadre(padreId: number) {
    const padre = await this.prisma.padre.findUnique({
      where: { id: BigInt(padreId) },
      include: { persona: true, alumnos: { include: { persona: true, escuela: true } } },
    });
    if (!padre) throw new NotFoundException('Padre no encontrado');
    const alumnos = (padre.alumnos || []).map(formatearAlumnoParaLista);
    return { message: 'Alumnos obtenidos', total: alumnos.length, data: alumnos };
  }

  async obtenerTodosUsuariosConTotales() {
    const personas = await this.prisma.persona.findMany({
      include: {
        administrador: true,
        director: { include: { escuela: true } },
        maestro: { include: { escuela: true } },
        alumno: { include: { escuela: true } },
        padre: true,
      },
      orderBy: { id: 'desc' },
    });

    const data = (personas as any[]).map(mapPersonaToUsuarioListItem);
    const totalesBase = data.reduce<Record<string, number>>((acc, usuario) => {
      const tipo = (usuario as any).tipoPersona || 'desconocido';
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
