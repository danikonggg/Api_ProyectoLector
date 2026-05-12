import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditContext {
  usuarioId?: number | null;
  ip?: string | null;
  detalles?: string | null;
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
          usuarioId: context?.usuarioId != null ? BigInt(context.usuarioId) : null,
          ip: context?.ip ?? null,
          detalles: context?.detalles ?? null,
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
