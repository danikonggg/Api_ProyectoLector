/**
 * ============================================
 * SERVICIO: LicenciasService
 * ============================================
 * Licencias individuales por libro: 1 licencia = 1 alumno.
 * Clave única, vencimiento, escuela, un solo uso.
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditService } from '../audit/audit.service';
import { Repository } from 'typeorm';
import { LicenciaLibro } from './entities/licencia-libro.entity';
import { Libro } from '../libros/entities/libro.entity';
import { Escuela } from '../personas/entities/escuela.entity';
import { Alumno } from '../personas/entities/alumno.entity';
import { EscuelaLibro } from '../escuelas/entities/escuela-libro.entity';
import { AlumnoLibro } from '../escuelas/entities/alumno-libro.entity';
import PDFDocument from 'pdfkit';

// Clave con 16 dígitos + guiones: DDDD-DDDD-DDDD-DDDD
const DIGITOS = '0123456789';

function generarClave(): string {
  const grupos: string[] = [];
  for (let i = 0; i < 4; i++) {
    let g = '';
    for (let j = 0; j < 4; j++) {
      g += DIGITOS[Math.floor(Math.random() * DIGITOS.length)];
    }
    grupos.push(g);
  }
  return grupos.join('-');
}

@Injectable()
export class LicenciasService {
  private readonly logger = new Logger(LicenciasService.name);

  constructor(
    @InjectRepository(LicenciaLibro)
    private readonly licenciaRepo: Repository<LicenciaLibro>,
    @InjectRepository(Libro)
    private readonly libroRepo: Repository<Libro>,
    @InjectRepository(Escuela)
    private readonly escuelaRepo: Repository<Escuela>,
    @InjectRepository(Alumno)
    private readonly alumnoRepo: Repository<Alumno>,
    @InjectRepository(EscuelaLibro)
    private readonly escuelaLibroRepo: Repository<EscuelaLibro>,
    @InjectRepository(AlumnoLibro)
    private readonly alumnoLibroRepo: Repository<AlumnoLibro>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Generar lote de licencias. Crea Escuela_Libro si no existe.
   */
  async generar(
    escuelaId: number,
    libroId: number,
    cantidad: number,
    fechaVencimiento: string,
  ) {
    const escuela = await this.escuelaRepo.findOne({ where: { id: escuelaId } });
    if (!escuela) throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);

    const libro = await this.libroRepo.findOne({
      where: { id: libroId },
      select: ['id', 'titulo', 'codigo', 'grado'],
    });
    if (!libro) throw new NotFoundException(`No se encontró el libro con ID ${libroId}`);
    if (libro.activo === false) {
      throw new BadRequestException('El libro está desactivado. Actívalo primero.');
    }

    const ven = new Date(fechaVencimiento);
    if (isNaN(ven.getTime())) {
      throw new BadRequestException('Fecha de vencimiento inválida.');
    }

    const clavesUsadas = new Set<string>();
    const licencias: LicenciaLibro[] = [];

    for (let i = 0; i < cantidad; i++) {
      let clave: string;
      let intentos = 0;
      do {
        clave = generarClave();
        if (clavesUsadas.has(clave)) continue;
        const existe = await this.licenciaRepo.findOne({ where: { clave } });
        if (!existe) break;
        clavesUsadas.add(clave);
        intentos++;
        if (intentos > 100) throw new BadRequestException('No se pudo generar claves únicas. Intenta con menos cantidad.');
      } while (true);
      clavesUsadas.add(clave);

      const lic = this.licenciaRepo.create({
        clave,
        libroId,
        escuelaId,
        alumnoId: null,
        fechaVencimiento: ven,
        activa: true,
        fechaAsignacion: null,
      });
      licencias.push(lic);
    }

    await this.licenciaRepo.save(licencias);

    // Crear Escuela_Libro si no existe (para que el libro aparezca en la escuela)
    let el = await this.escuelaLibroRepo.findOne({
      where: { escuelaId, libroId },
    });
    if (!el) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      el = this.escuelaLibroRepo.create({
        escuelaId,
        libroId,
        activo: true,
        fechaInicio: hoy,
        fechaFin: ven,
        grupo: null,
      });
      await this.escuelaLibroRepo.save(el);
    }

    this.logger.log(`Generadas ${cantidad} licencias para escuela ${escuelaId}, libro ${libroId}`);

    const claves = licencias.map((l) => l.clave);

    return {
      message: `Se generaron ${cantidad} licencias correctamente.`,
      description: `Libro "${libro.titulo}". Escuela: ${escuela.nombre}. Vencimiento: ${fechaVencimiento}.`,
      data: {
        escuelaId,
        libroId,
        titulo: libro.titulo,
        cantidad,
        fechaVencimiento,
        claves,
      },
    };
  }

  /**
   * Canjear licencia: alumno (o director/maestro en nombre) activa la licencia.
   * @param auditContext - Opcional. Si se pasa, se registra en auditoría (solo cuando se llama desde POST /licencias/canjear).
   */
  async canjear(
    clave: string,
    alumnoId: number,
    asignadoPorTipo: 'alumno' | 'director' | 'maestro',
    asignadoPorId: number,
    auditContext?: { usuarioId?: number | null; ip?: string | null },
  ) {
    const claveNorm = clave.trim().replace(/\s+/g, '');
    const lic = await this.licenciaRepo
      .createQueryBuilder('lic')
      .leftJoinAndSelect('lic.libro', 'libro')
      .leftJoinAndSelect('lic.escuela', 'escuela')
      .where('UPPER(REPLACE(lic.clave, \' \', \'\')) = UPPER(:clave)', { clave: claveNorm })
      .getOne();
    if (!lic) {
      throw new NotFoundException('Licencia no encontrada. Verifica la clave.');
    }

    if (lic.alumnoId != null) {
      throw new ConflictException('Esta licencia ya fue canjeada por otro alumno.');
    }
    if (!lic.activa) {
      throw new BadRequestException('Esta licencia está desactivada.');
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const ven = new Date(lic.fechaVencimiento);
    ven.setHours(0, 0, 0, 0);
    if (ven < hoy) {
      throw new BadRequestException('Esta licencia ha vencido.');
    }

    const alumno = await this.alumnoRepo.findOne({
      where: { id: alumnoId },
      relations: ['persona'],
    });
    if (!alumno) throw new NotFoundException(`No se encontró el alumno con ID ${alumnoId}`);
    if (Number(alumno.escuelaId) !== Number(lic.escuelaId)) {
      throw new BadRequestException('Esta licencia no corresponde a tu escuela.');
    }

    const yaTiene = await this.alumnoLibroRepo.findOne({
      where: { alumnoId, libroId: lic.libroId },
    });
    if (yaTiene) {
      throw new ConflictException('El alumno ya tiene asignado este libro.');
    }

    lic.alumnoId = alumnoId;
    lic.fechaAsignacion = new Date();
    await this.licenciaRepo.save(lic);

    const asignacion = this.alumnoLibroRepo.create({
      alumnoId,
      libroId: lic.libroId,
      porcentaje: 0,
      ultimoSegmentoId: null,
      ultimaLectura: null,
      fechaAsignacion: new Date(),
      asignadoPorTipo,
      asignadoPorId,
    });
    await this.alumnoLibroRepo.save(asignacion);

    this.logger.log(`Licencia ${lic.clave} canjeada por alumno ${alumnoId}`);

    if (auditContext) {
      await this.auditService.log('licencia_canjear', {
        usuarioId: auditContext?.usuarioId ?? null,
        ip: auditContext?.ip ?? null,
        detalles: `alumnoId=${alumnoId} libroId=${lic.libroId} canjeadoPor=${asignadoPorTipo}:${asignadoPorId}`,
      });
    }

    return {
      message: 'Licencia canjeada correctamente.',
      description: `El alumno ya puede ver el libro "${lic.libro?.titulo}" en "Mis libros".`,
      data: {
        libroId: lic.libroId,
        titulo: lic.libro?.titulo,
        alumnoId,
      },
    };
  }

  /**
   * Consumir una licencia para asignar libro a alumno (director/maestro).
   * Usado por asignarLibroAlAlumno cuando el flujo es por licencias.
   */
  async consumirLicenciaParaAlumno(
    escuelaId: number,
    alumnoId: number,
    libroId: number,
    asignadoPorTipo: 'director' | 'maestro',
    asignadoPorId: number,
  ) {
    const alumno = await this.alumnoRepo.findOne({ where: { id: alumnoId } });
    if (!alumno) throw new NotFoundException(`No se encontró el alumno con ID ${alumnoId}`);
    if (Number(alumno.escuelaId) !== Number(escuelaId)) {
      throw new BadRequestException('El alumno no pertenece a esta escuela.');
    }

    const lic = await this.licenciaRepo.findOne({
      where: {
        escuelaId,
        libroId,
        activa: true,
        alumnoId: null,
      },
      relations: ['libro'],
    });
    if (!lic) {
      throw new BadRequestException(
        'No hay licencias disponibles para este libro. Solicita más licencias al administrador.',
      );
    }

    if (Number(lic.libro?.grado) !== Number(alumno.grado)) {
      throw new BadRequestException(
        `Este libro no es apto para el grado del alumno. El libro es para grado ${lic.libro?.grado} y el alumno está en grado ${alumno.grado}.`,
      );
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const ven = new Date(lic.fechaVencimiento);
    ven.setHours(0, 0, 0, 0);
    if (ven < hoy) {
      throw new BadRequestException('Todas las licencias disponibles para este libro han vencido.');
    }

    return this.canjear(lic.clave, alumnoId, asignadoPorTipo, asignadoPorId);
  }

  /**
   * Verifica si hay licencias disponibles para un libro en una escuela.
   */
  async tieneLicenciasDisponibles(escuelaId: number, libroId: number): Promise<boolean> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const count = await this.licenciaRepo.count({
      where: {
        escuelaId,
        libroId,
        activa: true,
        alumnoId: null,
      },
    });
    if (count === 0) return false;
    const lic = await this.licenciaRepo.findOne({
      where: { escuelaId, libroId, activa: true, alumnoId: null },
    });
    if (!lic) return false;
    const ven = new Date(lic.fechaVencimiento);
    ven.setHours(0, 0, 0, 0);
    return ven >= hoy;
  }

  /**
   * Listar licencias (admin). Filtros: escuelaId, libroId, estado (disponible|usada|vencida)
   */
  async listar(
    escuelaId?: number,
    libroId?: number,
    estado?: string,
    page?: number,
    limit?: number,
  ) {
    const qb = this.licenciaRepo
      .createQueryBuilder('lic')
      .leftJoinAndSelect('lic.libro', 'libro')
      .leftJoinAndSelect('lic.escuela', 'escuela')
      .leftJoinAndSelect('lic.alumno', 'alumno')
      .leftJoinAndSelect('alumno.persona', 'persona')
      .orderBy('lic.createdAt', 'DESC');

    if (escuelaId) qb.andWhere('lic.escuelaId = :escuelaId', { escuelaId });
    if (libroId) qb.andWhere('lic.libroId = :libroId', { libroId });

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (estado == null) {
      // Cuando no se manda `estado`, no mostramos vencidas (ni desactivadas).
      qb.andWhere('lic.activa = true');
      qb.andWhere('lic.fechaVencimiento >= :hoy', { hoy: hoy.toISOString().slice(0, 10) });
    } else if (estado === 'disponible') {
      qb.andWhere('lic.alumnoId IS NULL');
      qb.andWhere('lic.activa = true');
      qb.andWhere('lic.fechaVencimiento >= :hoy', { hoy: hoy.toISOString().slice(0, 10) });
    } else if (estado === 'usada') {
      qb.andWhere('lic.alumnoId IS NOT NULL');
      qb.andWhere('lic.activa = true');
      qb.andWhere('lic.fechaVencimiento >= :hoy', { hoy: hoy.toISOString().slice(0, 10) });
    } else if (estado === 'vencida') {
      qb.andWhere('lic.fechaVencimiento < :hoy', { hoy: hoy.toISOString().slice(0, 10) });
    }

    const total = await qb.getCount();

    const pageSafe =
      page != null && Number.isInteger(Number(page)) ? Math.max(1, Number(page)) : undefined;
    const limitSafe =
      limit != null && Number.isInteger(Number(limit))
        ? Math.max(1, Math.min(Number(limit), 500))
        : undefined;

    if (pageSafe != null && limitSafe != null) {
      qb.skip((pageSafe - 1) * limitSafe).take(limitSafe);
    }

    const licencias = await qb.getMany();
    const data = licencias.map((l) => ({
      id: l.id,
      clave: l.clave,
      libroId: l.libroId,
      titulo: l.libro?.titulo,
      escuelaId: l.escuelaId,
      nombreEscuela: l.escuela?.nombre,
      alumnoId: l.alumnoId,
      alumno: l.alumno?.persona
        ? `${l.alumno.persona.nombre} ${l.alumno.persona.apellidoPaterno || ''}`
        : null,
      fechaVencimiento: l.fechaVencimiento,
      activa: l.activa,
      estado:
        l.alumnoId != null
          ? 'usada'
          : new Date(l.fechaVencimiento) < hoy
            ? 'vencida'
            : 'disponible',
      fechaAsignacion: l.fechaAsignacion,
      createdAt: l.createdAt,
    }));

    return {
      message: 'Licencias obtenidas correctamente.',
      total,
      data,
      ...(pageSafe != null && limitSafe != null && {
        meta: {
          page: pageSafe,
          limit: limitSafe,
          total,
          totalPages: Math.ceil(total / limitSafe),
        },
      }),
    };
  }

  /**
   * Listar licencias de una escuela.
   */
  async listarPorEscuela(
    escuelaId: number,
    libroId?: number,
    estado?: string,
    page?: number,
    limit?: number,
  ) {
    return this.listar(escuelaId, libroId, estado, page, limit);
  }

  /**
   * Totales de licencias por escuela y desglose por libro.
   *
   * "Disponibles" = alumnoId IS NULL AND activa=true AND fechaVencimiento >= hoy
   * "En uso"      = alumnoId IS NOT NULL
   * "Vencidas"    = alumnoId IS NULL AND fechaVencimiento < hoy
   */
  async obtenerTotalesPorEscuela(escuelaId: number): Promise<{
    message: string;
    data: {
      escuelaId: number;
      total: number;
      disponibles: number;
      enUso: number;
      vencidas: number;
      porLibro: Array<{
        libroId: number;
        titulo: string;
        total: number;
        disponibles: number;
        enUso: number;
        vencidas: number;
      }>;
    };
  }> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const hoyStr = hoy.toISOString().slice(0, 10);

    const rows = await this.licenciaRepo
      .createQueryBuilder('lic')
      .leftJoinAndSelect('lic.libro', 'libro')
      .where('lic.escuelaId = :escuelaId', { escuelaId })
      .select('lic.libroId', 'libroId')
      .addSelect('libro.titulo', 'titulo')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE
          WHEN lic.alumnoId IS NULL
           AND lic.activa = true
           AND lic.fechaVencimiento >= :hoy
          THEN 1 ELSE 0 END)`,
        'disponibles',
      )
      .addSelect(
        `SUM(CASE
          WHEN lic.alumnoId IS NOT NULL
          THEN 1 ELSE 0 END)`,
        'enUso',
      )
      .addSelect(
        `SUM(CASE
          WHEN lic.alumnoId IS NULL
           AND lic.fechaVencimiento < :hoy
          THEN 1 ELSE 0 END)`,
        'vencidas',
      )
      .groupBy('lic.libroId')
      .addGroupBy('libro.titulo')
      .setParameter('hoy', hoyStr)
      .orderBy('total', 'DESC')
      .getRawMany();

    const porLibro = rows.map((r) => ({
      libroId: Number(r.libroId),
      titulo: r.titulo ?? '—',
      total: Number(r.total ?? 0),
      disponibles: Number(r.disponibles ?? 0),
      enUso: Number(r.enUso ?? 0),
      vencidas: Number(r.vencidas ?? 0),
    }));

    const total = porLibro.reduce((acc, x) => acc + x.total, 0);
    const disponibles = porLibro.reduce((acc, x) => acc + x.disponibles, 0);
    const enUso = porLibro.reduce((acc, x) => acc + x.enUso, 0);
    const vencidas = porLibro.reduce((acc, x) => acc + x.vencidas, 0);

    return {
      message: 'Totales de licencias obtenidos correctamente.',
      data: {
        escuelaId,
        total,
        disponibles,
        enUso,
        vencidas,
        porLibro,
      },
    };
  }

  /**
   * Archiva (mueve) licencias vencidas a una tabla histórica.
   * Se borran de la tabla activa para que "no salgan" en listados por defecto.
   */
  async archivarLicenciasVencidas(escuelaId?: number, libroId?: number) {
    const archivadasYEliminadas = await this.licenciaRepo.manager.transaction(async (manager) => {
      const whereClauses: string[] = [];
      const params: any[] = [];

      // Se compara contra fecha (date) en DB.
      let idx = 1;
      let whereSql = `lic.fecha_vencimiento < CURRENT_DATE`;

      if (escuelaId != null) {
        whereSql += ` AND lic.escuela_id = $${idx}`;
        params.push(escuelaId);
        idx++;
      }
      if (libroId != null) {
        whereSql += ` AND lic.libro_id = $${idx}`;
        params.push(libroId);
        idx++;
      }

      const repo = manager.getRepository(LicenciaLibro);
      let qb = repo
        .createQueryBuilder('lic')
        .where('lic.fechaVencimiento < CURRENT_DATE');

      if (escuelaId != null) qb = qb.andWhere('lic.escuelaId = :escuelaId', { escuelaId });
      if (libroId != null) qb = qb.andWhere('lic.libroId = :libroId', { libroId });

      const totalAArchivar = await qb.getCount();
      if (totalAArchivar === 0) {
        return { totalAArchivar: 0, totalEliminadas: 0 };
      }

      const insertSql = `
        INSERT INTO "Licencia_Libro_Archivada"
          (licencia_id, clave, libro_id, escuela_id, alumno_id, fecha_vencimiento, activa, fecha_asignacion, motivo)
        SELECT
          lic.id,
          lic.clave,
          lic.libro_id,
          lic.escuela_id,
          lic.alumno_id,
          lic.fecha_vencimiento,
          lic.activa,
          lic.fecha_asignacion,
          'vencida'
        FROM "Licencia_Libro" lic
        WHERE ${whereSql}
      `;

      const deleteSql = `
        DELETE FROM "Licencia_Libro" lic
        WHERE ${whereSql}
      `;

      await manager.query(insertSql, params);
      await manager.query(deleteSql, params);

      return { totalAArchivar, totalEliminadas: totalAArchivar };
    });

    return {
      message: 'Licencias vencidas archivadas correctamente.',
      archivadas: archivadasYEliminadas.totalAArchivar,
      eliminadas: archivadasYEliminadas.totalEliminadas,
    };
  }

  /**
   * Exporta licencias a PDF (lista filtrada + totales).
   */
  async exportarLicenciasAPdf(
    escuelaId: number,
    libroId?: number,
    estado?: string,
  ): Promise<Buffer> {
    const licenciaResult = await this.listar(escuelaId, libroId, estado);
    const data: Array<{
      id: number;
      clave: string;
      titulo?: string;
      libroId: number;
      escuelaId: number;
      alumnoId: number | null;
      alumno?: string | null;
      fechaVencimiento: Date;
      activa: boolean;
      estado: string;
      fechaAsignacion: Date | null;
    }> = licenciaResult?.data ?? [];

    const escuela = await this.escuelaRepo.findOne({
      where: { id: escuelaId },
      select: ['id', 'nombre'],
    });
    const nombreEscuela = escuela?.nombre ?? `Escuela ${escuelaId}`;
    const estadoFiltro = estado ? ` (${estado})` : '';
    const tituloLibroFiltro = libroId ? ` | Libro ${libroId}` : '';

    // Totales derivados del filtro (se alinea con el campo `estado` del listar()).
    const disponibles = data.filter((x) => x.estado === 'disponible').length;
    const enUso = data.filter((x) => x.estado === 'usada').length;
    const vencidas = data.filter((x) => x.estado === 'vencida').length;

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk) =>
      buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const marginX = 30;
    const marginBottom = 30;
    const usableWidth = pageWidth - marginX * 2;

    const incluirAlumno = data.some((x) => x.alumnoId != null);

    const col = incluirAlumno
      ? {
          idx: 30,
          clave: 145,
          libro: 215,
          estado: 75,
          alumno: 190,
          venc: 90,
        }
      : {
          idx: 30,
          clave: 145,
          libro: 215,
          estado: 75,
          venc: 90,
        };

    const rowH = incluirAlumno ? 20 : 18;
    const headerH = incluirAlumno ? 26 : 22;

    const formatDate = (d: Date | null | undefined) => {
      if (!d) return '—';
      const s = String(d);
      return s.length >= 10 ? s.slice(0, 10) : s;
    };

    const estadoColorBg = (estadoTxt: string) => {
      if (estadoTxt === 'usada') return '#065f46'; // verde
      if (estadoTxt === 'vencida') return '#b91c1c'; // rojo
      return '#0f766e'; // disponible (teal)
    };

    const estadoColorText = () => '#ffffff';

    const trunc = (v: string, maxLen: number) => {
      if (v.length <= maxLen) return v;
      return v.slice(0, Math.max(0, maxLen - 1)) + '…';
    };

    const drawTableHeader = () => {
      const y = doc.y;
      doc
        .rect(marginX, y, usableWidth, headerH)
        .fill('#f3f4f6')
        .stroke('#e5e7eb');
      doc.fillColor('#111827').fontSize(9).font('Helvetica-Bold');

      const xIdx = marginX + 4;
      const xClave = marginX + col.idx + 8;
      const xLibro = xClave + col.clave;
      const xEstado = xLibro + col.libro;
      const xAlumno = incluirAlumno ? xEstado + col.estado : null;
      const xVenc = incluirAlumno
        ? xAlumno! + col.alumno
        : xEstado + col.estado;

      doc.text('Idx', xIdx, y + 6, { width: col.idx, align: 'left' });
      doc.text('Clave', xClave, y + 6, { width: col.clave, align: 'left' });
      doc.text('Libro', xLibro, y + 6, { width: col.libro, align: 'left' });
      doc.text('Estado', xEstado, y + 6, { width: col.estado, align: 'left' });
      if (incluirAlumno) {
        doc.text('Alumno', xAlumno!, y + 6, { width: col.alumno, align: 'left' });
      }
      doc.text('Venc.', xVenc, y + 6, { width: col.venc, align: 'left' });

      doc.y = y + headerH;
      doc.fillColor('black').font('Helvetica');
    };

    const drawRow = (lineIdx: number, l: any) => {
      const y = doc.y;
      const stripe = lineIdx % 2 === 0;
      if (stripe) {
        doc.rect(marginX, y, usableWidth, rowH).fill('#ffffff').stroke('#e5e7eb');
      } else {
        doc.rect(marginX, y, usableWidth, rowH).fill('#fafafa').stroke('#e5e7eb');
      }

      const xIdx = marginX + 4;
      const xClave = marginX + col.idx + 8;
      const xLibro = xClave + col.clave;
      const xEstado = xLibro + col.libro;
      const xAlumno = incluirAlumno ? xEstado + col.estado : null;
      const xVenc = incluirAlumno
        ? xAlumno! + col.alumno
        : xEstado + col.estado;

      doc
        .fontSize(8)
        .fillColor('#111827')
        .text(String(lineIdx), xIdx, y + 5, { width: col.idx, align: 'left' });

      doc.text(trunc(String(l.clave), 22), xClave, y + 5, { width: col.clave, align: 'left' });
      doc.text(trunc(String(l.titulo ?? l.libroId), 26), xLibro, y + 5, { width: col.libro, align: 'left' });

      const bg = estadoColorBg(l.estado);
      doc.rect(xEstado, y, col.estado, rowH).fill(bg);
      doc.fillColor(estadoColorText());
      doc
        .fontSize(8)
        .text(String(l.estado).toUpperCase(), xEstado + 4, y + 6, {
          width: col.estado - 8,
          align: 'left',
        });
      doc.fillColor('#111827');

      if (incluirAlumno) {
        const alumnoTxt =
          l.alumno ?? (l.alumnoId != null ? String(l.alumnoId) : '—');
        doc.text(trunc(String(alumnoTxt), 24), xAlumno!, y + 5, {
          width: col.alumno,
          align: 'left',
        });
      }
      doc.text(formatDate(l.fechaVencimiento), xVenc, y + 5, { width: col.venc, align: 'left' });

      doc.y = y + rowH;
    };

    // --- Resumen/Encabezado ---
    doc.fontSize(18).fillColor('#111827').font('Helvetica-Bold').text('Licencias por escuela', { align: 'left' });
    doc.moveDown(0.2);

    doc.fontSize(10).fillColor('#374151').font('Helvetica');
    doc.text(`Escuela: ${nombreEscuela}`);
    doc.text(`Generado en: ${new Date().toISOString()}`);
    doc.text(`Filtro: ${estadoFiltro}${tituloLibroFiltro}`);
    doc.moveDown(0.4);

    doc
      .fontSize(11)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text(
        `Total: ${data.length} | Disponibles: ${disponibles} | En uso: ${enUso} | Vencidas: ${vencidas}`,
      );

    // Totales por libro (derivados del filtro actual)
    const resumenPorLibro = new Map<
      number,
      { libroId: number; titulo: string; total: number; disponibles: number; enUso: number; vencidas: number }
    >();

    for (const l of data) {
      const key = Number(l.libroId);
      const item = resumenPorLibro.get(key) ?? {
        libroId: key,
        titulo: String(l.titulo ?? key),
        total: 0,
        disponibles: 0,
        enUso: 0,
        vencidas: 0,
      };
      item.total += 1;
      if (l.estado === 'disponible') item.disponibles += 1;
      if (l.estado === 'usada') item.enUso += 1;
      if (l.estado === 'vencida') item.vencidas += 1;
      resumenPorLibro.set(key, item);
    }

    const porLibroSorted = Array.from(resumenPorLibro.values()).sort(
      (a, b) => b.total - a.total,
    );
    const maxLibrosRes = 8;
    const porLibroTxt = porLibroSorted
      .slice(0, maxLibrosRes)
      .map(
        (x) =>
          `${trunc(x.titulo, 18)}: ${x.total} (Disp ${x.disponibles}, Uso ${x.enUso}, Venc ${x.vencidas})`,
      )
      .join('\n');

    doc.moveDown(0.25);
    doc.fontSize(9).fillColor('#111827').font('Helvetica-Bold').text('Totales por libro:');
    doc
      .fontSize(9)
      .fillColor('#374151')
      .font('Helvetica')
      .text(
        porLibroTxt + (porLibroSorted.length > maxLibrosRes ? `\n... (+${porLibroSorted.length - maxLibrosRes} libros)` : ''),
      );
    // Leyenda de estados
    doc.moveDown(0.15);
    doc.fontSize(8).fillColor('#111827').font('Helvetica-Bold').text('Leyenda:');
    const legendTop = doc.y + 1;
    const legendSq = 8;
    const legendGap = 105;
    const legendItems: Array<{ label: string; estado: string }> = [
      { label: 'Disponible', estado: 'disponible' },
      { label: 'Usada', estado: 'usada' },
      { label: 'Vencida', estado: 'vencida' },
    ];
    legendItems.forEach((it, idx) => {
      const x = marginX + idx * legendGap;
      doc.fillColor(estadoColorBg(it.estado)).rect(x, legendTop, legendSq, legendSq).fill(estadoColorBg(it.estado));
      doc.fillColor('#374151').fontSize(8).font('Helvetica').text(it.label, x + legendSq + 4, legendTop - 2);
    });
    doc.moveDown(0.25);

    // --- Tabla ---
    doc.fontSize(9).fillColor('#111827').font('Helvetica');

    // Evita PDF infinito: si hay miles, recortamos y avisamos.
    const max = 2000;
    const slice = data.slice(0, max);

    drawTableHeader();

    for (let i = 0; i < slice.length; i++) {
      // Asegura espacio para la fila
      if (doc.y + rowH > pageHeight - marginBottom) {
        doc.addPage();
        drawTableHeader();
      }
      drawRow(i + 1, slice[i]);
    }

    if (data.length > max) {
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#4b5563').font('Helvetica').text(
        `(Se muestran los primeros ${max} registros; total filtrado=${data.length}).`,
      );
    }

    doc.end();

    return await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);
    });
  }

  /**
   * Libros disponibles para asignar (con licencias disponibles). Usado por director/maestro.
   */
  async listarLibrosDisponiblesParaAsignar(escuelaId: number, alumnoId: number) {
    const alumno = await this.alumnoRepo.findOne({ where: { id: alumnoId } });
    if (!alumno) throw new NotFoundException(`No se encontró el alumno con ID ${alumnoId}`);
    if (Number(alumno.escuelaId) !== Number(escuelaId)) {
      throw new BadRequestException('El alumno no pertenece a esta escuela.');
    }

    const asignaciones = await this.escuelaLibroRepo.find({
      where: { escuelaId, activo: true },
      relations: ['libro', 'libro.materia'],
      order: { fechaInicio: 'DESC' },
    });

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const yaAsignados = await this.alumnoLibroRepo.find({
      where: { alumnoId },
      select: ['libroId'],
    });
    const idsAsignados = new Set(yaAsignados.map((x) => x.libroId));

    const disponibles: Array<{ id: number; titulo: string; codigo: string; grado: number; materia: string | null }> = [];

    for (const a of asignaciones) {
      if (!a.libro || a.libro.activo === false) continue;
      if (Number(a.libro.grado) !== Number(alumno.grado)) continue;
      if (a.grupo != null && (alumno.grupo == null || (alumno.grupo || '').trim().toUpperCase() !== (a.grupo || '').trim().toUpperCase())) continue;
      if (idsAsignados.has(a.libroId)) continue;

      const hayLicencia = await this.tieneLicenciasDisponibles(escuelaId, a.libroId);
      if (!hayLicencia) continue;

      disponibles.push({
        id: a.libro.id,
        titulo: a.libro.titulo,
        codigo: a.libro.codigo,
        grado: a.libro.grado,
        materia: a.libro.materia?.nombre ?? null,
      });
    }

    return {
      message: 'Libros disponibles para asignar (con licencias disponibles).',
      total: disponibles.length,
      data: disponibles,
    };
  }

  /**
   * Activar/desactivar licencia.
   */
  async setActiva(id: number, activa: boolean) {
    const lic = await this.licenciaRepo.findOne({ where: { id } });
    if (!lic) throw new NotFoundException(`No se encontró la licencia con ID ${id}`);
    lic.activa = activa;
    await this.licenciaRepo.save(lic);
    return {
      message: activa ? 'Licencia activada.' : 'Licencia desactivada.',
      data: { id, clave: lic.clave, activa },
    };
  }

  /**
   * Eliminar una licencia (solo si está disponible, no canjeada).
   * Se archiva en Licencia_Libro_Archivada con motivo 'eliminada_admin' antes de borrar.
   */
  async eliminarLicencia(id: number) {
    const lic = await this.licenciaRepo.findOne({ where: { id } });
    if (!lic) {
      throw new NotFoundException(`No se encontró la licencia con ID ${id}`);
    }
    if (lic.alumnoId != null) {
      throw new BadRequestException(
        'No se puede eliminar una licencia ya canjeada. Solo se pueden eliminar licencias disponibles.',
      );
    }

    await this.licenciaRepo.manager.transaction(async (manager) => {
      await manager.query(
        `
        INSERT INTO "Licencia_Libro_Archivada"
          (licencia_id, clave, libro_id, escuela_id, alumno_id, fecha_vencimiento, activa, fecha_asignacion, motivo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'eliminada_admin')
        `,
        [
          lic.id,
          lic.clave,
          lic.libroId,
          lic.escuelaId,
          lic.alumnoId,
          lic.fechaVencimiento,
          lic.activa,
          lic.fechaAsignacion,
        ],
      );
      await manager.delete(LicenciaLibro, { id: lic.id });
    });

    this.logger.log(`Licencia ${lic.clave} (id=${id}) eliminada por admin`);
    return {
      message: 'Licencia eliminada correctamente.',
      description: 'La licencia se archivó con motivo "eliminada_admin" para auditoría.',
      data: { id, clave: lic.clave },
    };
  }

  /**
   * Eliminar licencias disponibles en lote (por error al generar).
   * Solo elimina licencias con alumnoId IS NULL, activa=true y no vencidas.
   * Se archivan antes de borrar para auditoría.
   * - Sin escuelaId: todas las escuelas
   * - Sin libroId: todos los libros
   * - Sin cantidad: todas las que coincidan
   */
  async eliminarLicenciasDisponibles(
    escuelaId?: number,
    libroId?: number,
    cantidad?: number,
  ) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const hoyStr = hoy.toISOString().slice(0, 10);

    const qb = this.licenciaRepo
      .createQueryBuilder('lic')
      .where('lic.alumnoId IS NULL')
      .andWhere('lic.activa = true')
      .andWhere('lic.fechaVencimiento >= :hoy', { hoy: hoyStr })
      .orderBy('lic.createdAt', 'ASC');

    if (escuelaId != null) {
      qb.andWhere('lic.escuelaId = :escuelaId', { escuelaId });
    }
    if (libroId != null) {
      qb.andWhere('lic.libroId = :libroId', { libroId });
    }
    if (cantidad != null && cantidad > 0) {
      qb.take(Math.min(cantidad, 10000));
    }

    const licencias = await qb.getMany();
    if (licencias.length === 0) {
      return {
        message: 'No hay licencias disponibles para eliminar.',
        eliminadas: 0,
        data: {
          escuelaId: escuelaId ?? null,
          libroId: libroId ?? null,
          clavesEliminadas: [] as string[],
        },
      };
    }

    await this.licenciaRepo.manager.transaction(async (manager) => {
      for (const lic of licencias) {
        await manager.query(
          `
          INSERT INTO "Licencia_Libro_Archivada"
            (licencia_id, clave, libro_id, escuela_id, alumno_id, fecha_vencimiento, activa, fecha_asignacion, motivo)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'eliminada_admin')
          `,
          [
            lic.id,
            lic.clave,
            lic.libroId,
            lic.escuelaId,
            lic.alumnoId,
            lic.fechaVencimiento,
            lic.activa,
            lic.fechaAsignacion,
          ],
        );
        await manager.delete(LicenciaLibro, { id: lic.id });
      }
    });

    const claves = licencias.map((l) => l.clave);
    this.logger.log(
      `Eliminadas ${licencias.length} licencias disponibles (escuela=${escuelaId ?? 'todas'}, libro=${libroId ?? 'todos'})`,
    );
    return {
      message: `Se eliminaron ${licencias.length} licencia(s) correctamente.`,
      description:
        'Las licencias se archivaron con motivo "eliminada_admin" para auditoría.',
      eliminadas: licencias.length,
      data: {
        escuelaId: escuelaId ?? null,
        libroId: libroId ?? null,
        clavesEliminadas: claves,
      },
    };
  }
}
