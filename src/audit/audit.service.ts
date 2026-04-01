import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { Persona } from '../personas/entities/persona.entity';

export interface AuditContext {
  usuarioId?: number | null;
  ip?: string | null;
  detalles?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    @InjectRepository(Persona)
    private readonly personaRepository: Repository<Persona>,
  ) {}

  /**
   * Registra una acción en el log de auditoría
   */
  async log(accion: string, context?: AuditContext): Promise<void> {
    try {
      const entry = this.auditRepository.create({
        accion,
        usuarioId: context?.usuarioId ?? null,
        ip: context?.ip ?? null,
        detalles: context?.detalles ?? null,
      });
      await this.auditRepository.save(entry);
    } catch (e) {
      this.logger.error(`Error al registrar auditoría: ${accion}`, e);
    }
  }

  /**
   * Obtiene los logs de auditoría con paginación (solo admin)
   */
  async findAll(page?: number, limit?: number) {
    const qb = this.auditRepository
      .createQueryBuilder('audit')
      .orderBy('audit.fecha', 'DESC');

    const total = await qb.getCount();

    if (page != null && limit != null && page >= 1 && limit >= 1) {
      qb.skip((page - 1) * limit).take(limit);
    }

    const data = await qb.getMany();

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

  /**
   * Últimas conexiones (solo eventos login).
   */
  async findUltimasConexiones(page?: number, limit?: number) {
    const qb = this.auditRepository
      .createQueryBuilder('audit')
      .where('audit.accion = :accion', { accion: 'login' })
      .orderBy('audit.fecha', 'DESC');

    const total = await qb.getCount();

    if (page != null && limit != null && page >= 1 && limit >= 1) {
      qb.skip((page - 1) * limit).take(limit);
    }

    const data = await qb.getMany();

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

  /**
   * Métricas de conexiones: horas conectado vs sin conexión por rol.
   */
  async getMetricasConexiones() {
    const ahora = new Date();
    const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
    const hace48h = new Date(ahora.getTime() - 48 * 60 * 60 * 1000);
    const hace7d = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const hace30d = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);

    const personas = await this.personaRepository.find({
      where: [
        { tipoPersona: 'administrador' },
        { tipoPersona: 'director' },
        { tipoPersona: 'maestro' },
        { tipoPersona: 'alumno' },
        { tipoPersona: 'padre' },
      ],
      select: ['id', 'tipoPersona', 'nombre', 'apellidoPaterno', 'correo', 'ultimaConexion'],
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
