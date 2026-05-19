import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditContext {
  usuarioId?: number | null;
  ip?: string | null;
  detalles?: string | null;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  tipoPersona?: string | null;
  bodySnapshot?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(accion: string, context?: AuditContext): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          accion,
          usuarioId:    context?.usuarioId != null ? BigInt(context.usuarioId) : null,
          ip:           context?.ip ?? null,
          detalles:     context?.detalles ?? null,
          method:       context?.method ?? null,
          path:         context?.path ?? null,
          statusCode:   context?.statusCode ?? null,
          durationMs:   context?.durationMs ?? null,
          tipoPersona:  context?.tipoPersona ?? null,
          bodySnapshot: context?.bodySnapshot ?? null,
        },
      });
    } catch (e) {
      this.logger.error(`Error al registrar auditoría: ${accion}`, e);
    }
  }

  async findAll(page?: number, limit?: number) {
    const total = await this.prisma.auditLog.count();

    const skip =
      page != null && limit != null && page >= 1 && limit >= 1 ? (page - 1) * limit : undefined;
    const take = skip != null ? limit : undefined;

    const data = await this.prisma.auditLog.findMany({
      orderBy: { fecha: 'desc' },
      ...(skip != null && { skip, take }),
    });

    const meta =
      page != null && limit != null
        ? { page, limit, total, totalPages: Math.ceil(total / limit) }
        : undefined;

    return {
      message: 'Logs de auditoría obtenidos correctamente',
      description: `Se encontraron ${data.length} registro(s)`,
      total,
      ...(meta && { meta }),
      data,
    };
  }

  async findUltimasConexiones(page?: number, limit?: number) {
    const total = await this.prisma.auditLog.count({ where: { accion: 'login' } });

    const skip =
      page != null && limit != null && page >= 1 && limit >= 1 ? (page - 1) * limit : undefined;
    const take = skip != null ? limit : undefined;

    const data = await this.prisma.auditLog.findMany({
      where: { accion: 'login' },
      orderBy: { fecha: 'desc' },
      ...(skip != null && { skip, take }),
    });

    const meta =
      page != null && limit != null
        ? { page, limit, total, totalPages: Math.ceil(total / limit) }
        : undefined;

    return {
      message: 'Últimas conexiones obtenidas correctamente',
      description: `Logins registrados: ${data.length}`,
      total,
      ...(meta && { meta }),
      data,
    };
  }

  async getTelemetryResumen() {
    const ahora = new Date();
    const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
    const hace7d  = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [total24h, errores24h, total7d, errores7d, promedioMs] = await Promise.all([
      this.prisma.auditLog.count({ where: { fecha: { gte: hace24h }, method: { not: null } } }),
      this.prisma.auditLog.count({ where: { fecha: { gte: hace24h }, statusCode: { gte: 400 } } }),
      this.prisma.auditLog.count({ where: { fecha: { gte: hace7d }, method: { not: null } } }),
      this.prisma.auditLog.count({ where: { fecha: { gte: hace7d }, statusCode: { gte: 400 } } }),
      this.prisma.auditLog.aggregate({ _avg: { durationMs: true }, where: { fecha: { gte: hace24h }, method: { not: null } } }),
    ]);

    const accionesFrecuentes = await this.prisma.auditLog.groupBy({
      by: ['accion'],
      _count: { accion: true },
      where: { fecha: { gte: hace24h } },
      orderBy: { _count: { accion: 'desc' } },
      take: 5,
    });

    return {
      message: 'Resumen de telemetría',
      generadoEn: ahora.toISOString(),
      ultimas24h: {
        peticiones: total24h,
        errores: errores24h,
        tasaError: total24h > 0 ? `${((errores24h / total24h) * 100).toFixed(1)}%` : '0%',
        promedioRespuestaMs: Math.round(promedioMs._avg.durationMs ?? 0),
      },
      ultimos7d: {
        peticiones: total7d,
        errores: errores7d,
        tasaError: total7d > 0 ? `${((errores7d / total7d) * 100).toFixed(1)}%` : '0%',
      },
      accionesMasFrecuentes: accionesFrecuentes.map((a) => ({
        accion: a.accion,
        total: a._count.accion,
      })),
    };
  }

  async getTelemetryEndpoints(desde?: Date) {
    const fechaDesde = desde ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const grupos = await this.prisma.auditLog.groupBy({
      by: ['method', 'path'],
      _count: { id: true },
      _avg: { durationMs: true },
      _min: { durationMs: true },
      _max: { durationMs: true },
      where: { fecha: { gte: fechaDesde }, method: { not: null }, path: { not: null } },
      orderBy: { _count: { id: 'desc' } },
      take: 30,
    });

    const erroresPorPath = await this.prisma.auditLog.groupBy({
      by: ['path'],
      _count: { id: true },
      where: { fecha: { gte: fechaDesde }, statusCode: { gte: 400 }, path: { not: null } },
    });

    const erroresMap = new Map(erroresPorPath.map((e) => [e.path, e._count.id]));

    return {
      message: 'Estadísticas por endpoint',
      desde: fechaDesde.toISOString(),
      data: grupos.map((g) => ({
        method: g.method,
        path: g.path,
        totalLlamadas: g._count.id,
        errores: erroresMap.get(g.path ?? '') ?? 0,
        tasaError: g._count.id > 0
          ? `${(((erroresMap.get(g.path ?? '') ?? 0) / g._count.id) * 100).toFixed(1)}%`
          : '0%',
        tiempoMs: {
          promedio: Math.round(g._avg.durationMs ?? 0),
          minimo: g._min.durationMs ?? 0,
          maximo: g._max.durationMs ?? 0,
        },
      })),
    };
  }

  async getTelemetryRoles(desde?: Date) {
    const fechaDesde = desde ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const grupos = await this.prisma.auditLog.groupBy({
      by: ['tipoPersona'],
      _count: { id: true },
      _avg: { durationMs: true },
      where: { fecha: { gte: fechaDesde }, method: { not: null } },
      orderBy: { _count: { id: 'desc' } },
    });

    return {
      message: 'Actividad por rol',
      desde: fechaDesde.toISOString(),
      data: grupos.map((g) => ({
        rol: g.tipoPersona ?? 'anónimo',
        totalAcciones: g._count.id,
        tiempoPromedioMs: Math.round(g._avg.durationMs ?? 0),
      })),
    };
  }

  async getTelemetryErrores(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { statusCode: { gte: 400 } };

    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, fecha: true, method: true, path: true,
          statusCode: true, durationMs: true, tipoPersona: true,
          usuarioId: true, ip: true, bodySnapshot: true,
        },
      }),
    ]);

    return {
      message: 'Peticiones con error',
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      data: data.map((d) => ({ ...d, id: Number(d.id), usuarioId: d.usuarioId ? Number(d.usuarioId) : null })),
    };
  }

  async getMetricasConexiones() {
    const ahora = new Date();
    const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
    const hace48h = new Date(ahora.getTime() - 48 * 60 * 60 * 1000);
    const hace7d = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const hace30d = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);

    const personas = await this.prisma.persona.findMany({
      where: {
        tipoPersona: { in: ['administrador', 'director', 'maestro', 'alumno', 'padre'] },
      },
      select: {
        id: true,
        tipoPersona: true,
        nombre: true,
        apellidoPaterno: true,
        correo: true,
        ultimaConexion: true,
      },
    });

    const porRol = {
      administrador: { conectados24h: 0, conectados48h: 0, conectados7d: 0, conectados30d: 0, sinConexionNunca: 0, sinConexionMas7d: 0, sinConexionMas30d: 0, total: 0 },
      director: { conectados24h: 0, conectados48h: 0, conectados7d: 0, conectados30d: 0, sinConexionNunca: 0, sinConexionMas7d: 0, sinConexionMas30d: 0, total: 0 },
      maestro: { conectados24h: 0, conectados48h: 0, conectados7d: 0, conectados30d: 0, sinConexionNunca: 0, sinConexionMas7d: 0, sinConexionMas30d: 0, total: 0 },
      alumno: { conectados24h: 0, conectados48h: 0, conectados7d: 0, conectados30d: 0, sinConexionNunca: 0, sinConexionMas7d: 0, sinConexionMas30d: 0, total: 0 },
      padre: { conectados24h: 0, conectados48h: 0, conectados7d: 0, conectados30d: 0, sinConexionNunca: 0, sinConexionMas7d: 0, sinConexionMas30d: 0, total: 0 },
    };

    for (const p of personas) {
      const rol = (p.tipoPersona || 'alumno').toLowerCase() as keyof typeof porRol;
      if (!porRol[rol]) continue;
      porRol[rol].total++;

      const uc = p.ultimaConexion ? new Date(p.ultimaConexion) : null;

      if (!uc) {
        porRol[rol].sinConexionNunca++;
      } else {
        if (uc >= hace24h) porRol[rol].conectados24h++;
        if (uc >= hace48h) porRol[rol].conectados48h++;
        if (uc >= hace7d) porRol[rol].conectados7d++;
        if (uc >= hace30d) porRol[rol].conectados30d++;
        if (uc < hace7d) porRol[rol].sinConexionMas7d++;
        if (uc < hace30d) porRol[rol].sinConexionMas30d++;
      }
    }

    const totales = {
      conectados24h: Object.values(porRol).reduce((s, r) => s + r.conectados24h, 0),
      conectados48h: Object.values(porRol).reduce((s, r) => s + r.conectados48h, 0),
      conectados7d: Object.values(porRol).reduce((s, r) => s + r.conectados7d, 0),
      conectados30d: Object.values(porRol).reduce((s, r) => s + r.conectados30d, 0),
      sinConexionNunca: Object.values(porRol).reduce((s, r) => s + r.sinConexionNunca, 0),
      sinConexionMas7d: Object.values(porRol).reduce((s, r) => s + r.sinConexionMas7d, 0),
      sinConexionMas30d: Object.values(porRol).reduce((s, r) => s + r.sinConexionMas30d, 0),
      total: personas.length,
    };

    return {
      message: 'Métricas de conexiones obtenidas correctamente',
      description: 'Usuarios conectados por período vs sin conexión reciente',
      generadoEn: ahora.toISOString(),
      totales,
      porRol,
    };
  }
}
