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
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { ListarLibrosDisponiblesUseCase } from './application/listar-libros-disponibles.use-case';

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
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly listarLibrosDisponiblesUseCase: ListarLibrosDisponiblesUseCase,
  ) {}

  /**
   * Generar lote de licencias. Crea Escuela_Libro si no existe.
   */
  async generar(escuelaId: number, libroId: number, cantidad: number, fechaVencimiento: string) {
    const escuela = await this.prisma.escuela.findUnique({ where: { id: BigInt(escuelaId) } });
    if (!escuela) throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);

    const libro = await this.prisma.libro.findUnique({
      where: { id: BigInt(libroId) },
      select: { id: true, titulo: true, codigo: true, grado: true, activo: true },
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
    const licenciasData: Array<{
      clave: string;
      libroId: bigint;
      escuelaId: bigint;
      alumnoId: null;
      fechaVencimiento: Date;
      activa: boolean;
      fechaAsignacion: null;
    }> = [];

    for (let i = 0; i < cantidad; i++) {
      let clave: string;
      let intentos = 0;
      do {
        clave = generarClave();
        if (clavesUsadas.has(clave)) continue;
        const existe = await this.prisma.licenciaLibro.findUnique({ where: { clave } });
        if (!existe) break;
        clavesUsadas.add(clave);
        intentos++;
        if (intentos > 100)
          throw new BadRequestException(
            'No se pudo generar claves únicas. Intenta con menos cantidad.',
          );
      } while (true);
      clavesUsadas.add(clave);

      licenciasData.push({
        clave,
        libroId: BigInt(libroId),
        escuelaId: BigInt(escuelaId),
        alumnoId: null,
        fechaVencimiento: ven,
        activa: true,
        fechaAsignacion: null,
      });
    }

    await this.prisma.licenciaLibro.createMany({ data: licenciasData });

    let el = await this.prisma.escuelaLibro.findFirst({
      where: { escuelaId: BigInt(escuelaId), libroId: BigInt(libroId) },
    });
    if (!el) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      el = await this.prisma.escuelaLibro.create({
        data: {
          escuelaId: BigInt(escuelaId),
          libroId: BigInt(libroId),
          activo: true,
          fechaInicio: hoy,
          fechaFin: ven,
          grupo: null,
        },
      });
    }

    this.logger.log(`Generadas ${cantidad} licencias para escuela ${escuelaId}, libro ${libroId}`);

    return {
      message: `Se generaron ${cantidad} licencias correctamente.`,
      description: `Libro "${libro.titulo}". Escuela: ${escuela.nombre}. Vencimiento: ${fechaVencimiento}.`,
      data: {
        escuelaId,
        libroId,
        titulo: libro.titulo,
        cantidad,
        fechaVencimiento,
        claves: licenciasData.map((l) => l.clave),
      },
    };
  }

  /**
   * Canjear licencia: alumno (o director/maestro en nombre) activa la licencia.
   */
  async canjear(
    clave: string,
    alumnoId: number,
    asignadoPorTipo: 'alumno' | 'director' | 'maestro',
    asignadoPorId: number,
    auditContext?: { usuarioId?: number | null; ip?: string | null },
  ) {
    const claveNorm = clave.trim().replace(/\s+/g, '');

    const resultado = await this.prisma.$transaction(async (tx) => {
      const lics = await tx.$queryRaw<
        Array<{
          id: bigint;
          clave: string;
          libroId: bigint;
          escuelaId: bigint;
          alumnoId: bigint | null;
          fechaVencimiento: Date;
          activa: boolean;
          fechaAsignacion: Date | null;
        }>
      >`
        SELECT id, clave, libro_id as "libroId", escuela_id as "escuelaId",
               alumno_id as "alumnoId", fecha_vencimiento as "fechaVencimiento",
               activa, fecha_asignacion as "fechaAsignacion"
        FROM "Licencia_Libro"
        WHERE UPPER(REPLACE(clave, ' ', '')) = UPPER(${claveNorm})
        LIMIT 1
      `;

      const licRow = lics[0];
      if (!licRow) {
        throw new NotFoundException('Licencia no encontrada. Verifica la clave.');
      }

      if (licRow.alumnoId != null) {
        throw new ConflictException('Esta licencia ya fue canjeada por otro alumno.');
      }
      if (!licRow.activa) {
        throw new BadRequestException('Esta licencia está desactivada.');
      }

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const ven = new Date(licRow.fechaVencimiento);
      ven.setHours(0, 0, 0, 0);
      if (ven < hoy) {
        throw new BadRequestException('Esta licencia ha vencido.');
      }

      const alumno = await tx.alumno.findUnique({
        where: { id: BigInt(alumnoId) },
        include: { persona: true },
      });
      if (!alumno) {
        throw new NotFoundException(`No se encontró el alumno con ID ${alumnoId}`);
      }
      if (Number(alumno.escuelaId) !== Number(licRow.escuelaId)) {
        throw new BadRequestException('Esta licencia no corresponde a tu escuela.');
      }

      const asignacionExistente = await tx.alumnoLibro.findFirst({
        where: { alumnoId: BigInt(alumnoId), libroId: licRow.libroId },
      });
      if (asignacionExistente) {
        const tieneAccesoVigente = await this.accesoLibroActivoSegunLicencia(alumnoId, Number(licRow.libroId));
        if (tieneAccesoVigente) {
          throw new ConflictException('El alumno ya tiene asignado este libro.');
        }
      }

      const claimed = await tx.$executeRaw`
        UPDATE "Licencia_Libro"
        SET alumno_id = ${BigInt(alumnoId)}, fecha_asignacion = NOW()
        WHERE id = ${licRow.id}
          AND alumno_id IS NULL
          AND activa = true
          AND fecha_vencimiento >= CURRENT_DATE
      `;

      if (claimed !== 1) {
        throw new ConflictException('Esta licencia ya fue canjeada por otro alumno.');
      }

      if (asignacionExistente) {
        await tx.alumnoLibro.update({
          where: { id: asignacionExistente.id },
          data: { asignadoPorTipo, asignadoPorId: BigInt(asignadoPorId) },
        });
      } else {
        await tx.alumnoLibro.create({
          data: {
            alumnoId: BigInt(alumnoId),
            libroId: licRow.libroId,
            porcentaje: 0,
            ultimoSegmentoId: null,
            ultimaLectura: null,
            fechaAsignacion: new Date(),
            asignadoPorTipo,
            asignadoPorId: BigInt(asignadoPorId),
          },
        });
      }

      const libroData = await tx.libro.findUnique({
        where: { id: licRow.libroId },
        select: { titulo: true },
      });

      return {
        libroId: Number(licRow.libroId),
        titulo: libroData?.titulo,
        clave: licRow.clave,
      };
    });

    this.logger.log(`Licencia ${resultado.clave} canjeada por alumno ${alumnoId}`);

    if (auditContext) {
      await this.auditService.log('licencia_canjear', {
        usuarioId: auditContext?.usuarioId ?? null,
        ip: auditContext?.ip ?? null,
        detalles: `alumnoId=${alumnoId} libroId=${resultado.libroId} canjeadoPor=${asignadoPorTipo}:${asignadoPorId}`,
      });
    }

    return {
      message: 'Licencia canjeada correctamente.',
      description: `El alumno ya puede ver el libro "${resultado.titulo}" en "Mis libros".`,
      data: {
        libroId: resultado.libroId,
        titulo: resultado.titulo,
        alumnoId,
      },
    };
  }

  /**
   * Consumir una licencia para asignar libro a alumno (director/maestro).
   */
  async consumirLicenciaParaAlumno(
    escuelaId: number,
    alumnoId: number,
    libroId: number,
    asignadoPorTipo: 'director' | 'maestro',
    asignadoPorId: number,
  ) {
    const alumno = await this.prisma.alumno.findUnique({ where: { id: BigInt(alumnoId) } });
    if (!alumno) throw new NotFoundException(`No se encontró el alumno con ID ${alumnoId}`);
    if (Number(alumno.escuelaId) !== Number(escuelaId)) {
      throw new BadRequestException('El alumno no pertenece a esta escuela.');
    }

    const lic = await this.prisma.licenciaLibro.findFirst({
      where: {
        escuelaId: BigInt(escuelaId),
        libroId: BigInt(libroId),
        activa: true,
        alumnoId: null,
      },
      include: { libro: true },
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
    const count = await this.prisma.licenciaLibro.count({
      where: {
        escuelaId: BigInt(escuelaId),
        libroId: BigInt(libroId),
        activa: true,
        alumnoId: null,
      },
    });
    if (count === 0) return false;
    const lic = await this.prisma.licenciaLibro.findFirst({
      where: { escuelaId: BigInt(escuelaId), libroId: BigInt(libroId), activa: true, alumnoId: null },
    });
    if (!lic) return false;
    const ven = new Date(lic.fechaVencimiento);
    ven.setHours(0, 0, 0, 0);
    return ven >= hoy;
  }

  /**
   * Acceso al libro si existe al menos una licencia activa y no vencida para ese alumno.
   */
  async accesoLibroActivoSegunLicencia(alumnoId: number, libroId: number): Promise<boolean> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const lic = await this.prisma.licenciaLibro.findFirst({
      where: { alumnoId: BigInt(alumnoId), libroId: BigInt(libroId), activa: true },
    });
    if (!lic) return false;
    const ven = new Date(lic.fechaVencimiento);
    ven.setHours(0, 0, 0, 0);
    return ven >= hoy;
  }

  /**
   * Listar licencias (admin). Filtros: escuelaId, libroId, estado (disponible|usada|vencida|desactivada)
   */
  async listar(
    escuelaId?: number,
    libroId?: number,
    estado?: string,
    page?: number,
    limit?: number,
  ) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const where: Prisma.LicenciaLibroWhereInput = {};
    if (escuelaId) where.escuelaId = BigInt(escuelaId);
    if (libroId) where.libroId = BigInt(libroId);

    if (estado == null) {
      where.activa = true;
      where.fechaVencimiento = { gte: hoy };
    } else if (estado === 'disponible') {
      where.alumnoId = null;
      where.activa = true;
      where.fechaVencimiento = { gte: hoy };
    } else if (estado === 'usada') {
      where.alumnoId = { not: null };
      where.activa = true;
      where.fechaVencimiento = { gte: hoy };
    } else if (estado === 'vencida') {
      where.fechaVencimiento = { lt: hoy };
    } else if (estado === 'desactivada' || estado === 'baja') {
      where.activa = false;
    }

    const total = await this.prisma.licenciaLibro.count({ where });

    const pageSafe =
      page != null && Number.isInteger(Number(page)) ? Math.max(1, Number(page)) : undefined;
    const limitSafe =
      limit != null && Number.isInteger(Number(limit))
        ? Math.max(1, Math.min(Number(limit), 500))
        : undefined;

    const licencias = await this.prisma.licenciaLibro.findMany({
      where,
      include: {
        libro: true,
        escuela: true,
        alumno: { include: { persona: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...(pageSafe != null && limitSafe != null
        ? { skip: (pageSafe - 1) * limitSafe, take: limitSafe }
        : {}),
    });

    const data = licencias.map((l) => {
      let estadoEtiqueta: string;
      if (!l.activa) {
        estadoEtiqueta = 'desactivada';
      } else if (l.alumnoId != null) {
        estadoEtiqueta = new Date(l.fechaVencimiento) < hoy ? 'vencida' : 'usada';
      } else if (new Date(l.fechaVencimiento) < hoy) {
        estadoEtiqueta = 'vencida';
      } else {
        estadoEtiqueta = 'disponible';
      }
      return {
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
        estado: estadoEtiqueta,
        fechaAsignacion: l.fechaAsignacion,
        createdAt: l.createdAt,
      };
    });

    return {
      message: 'Licencias obtenidas correctamente.',
      total,
      data,
      ...(pageSafe != null &&
        limitSafe != null && {
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

    const rows = await this.prisma.$queryRaw<
      Array<{
        libroId: bigint;
        titulo: string | null;
        total: bigint;
        disponibles: bigint;
        enUso: bigint;
        vencidas: bigint;
      }>
    >`
      SELECT
        lic.libro_id AS "libroId",
        libro.titulo,
        COUNT(*) AS total,
        SUM(CASE
          WHEN lic.alumno_id IS NULL
           AND lic.activa = true
           AND lic.fecha_vencimiento >= ${hoyStr}::date
          THEN 1 ELSE 0 END) AS disponibles,
        SUM(CASE
          WHEN lic.alumno_id IS NOT NULL
          THEN 1 ELSE 0 END) AS "enUso",
        SUM(CASE
          WHEN lic.alumno_id IS NULL
           AND lic.fecha_vencimiento < ${hoyStr}::date
          THEN 1 ELSE 0 END) AS vencidas
      FROM "Licencia_Libro" lic
      LEFT JOIN "Libro" libro ON libro.id = lic.libro_id
      WHERE lic.escuela_id = ${BigInt(escuelaId)}
      GROUP BY lic.libro_id, libro.titulo
      ORDER BY total DESC
    `;

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
   */
  async archivarLicenciasVencidas(escuelaId?: number, libroId?: number) {
    const where: Prisma.LicenciaLibroWhereInput = { fechaVencimiento: { lt: new Date() } };
    if (escuelaId != null) where.escuelaId = BigInt(escuelaId);
    if (libroId != null) where.libroId = BigInt(libroId);

    const totalAArchivar = await this.prisma.licenciaLibro.count({ where });
    if (totalAArchivar === 0) {
      return { message: 'No hay licencias vencidas para archivar.', archivadas: 0, eliminadas: 0 };
    }

    const params: any[] = [];
    let whereSql = `lic.fecha_vencimiento < CURRENT_DATE`;
    let idx = 1;
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

    const insertSql = `
      INSERT INTO "Licencia_Libro_Archivada"
        (licencia_id, clave, libro_id, escuela_id, alumno_id, fecha_vencimiento, activa, fecha_asignacion, motivo)
      SELECT
        lic.id, lic.clave, lic.libro_id, lic.escuela_id, lic.alumno_id,
        lic.fecha_vencimiento, lic.activa, lic.fecha_asignacion, 'vencida'
      FROM "Licencia_Libro" lic
      WHERE ${whereSql}
    `;
    const deleteSql = `DELETE FROM "Licencia_Libro" lic WHERE ${whereSql}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(insertSql, ...params);
      await tx.$executeRawUnsafe(deleteSql, ...params);
    });

    return {
      message: 'Licencias vencidas archivadas correctamente.',
      archivadas: totalAArchivar,
      eliminadas: totalAArchivar,
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
      id: any;
      clave: string;
      titulo?: string;
      libroId: any;
      escuelaId: any;
      alumnoId: any;
      alumno?: string | null;
      fechaVencimiento: Date;
      activa: boolean;
      estado: string;
      fechaAsignacion: Date | null;
    }> = licenciaResult?.data ?? [];

    const escuela = await this.prisma.escuela.findUnique({
      where: { id: BigInt(escuelaId) },
      select: { id: true, nombre: true },
    });
    const nombreEscuela = escuela?.nombre ?? `Escuela ${escuelaId}`;
    const estadoFiltro = estado ? ` (${estado})` : '';
    const tituloLibroFiltro = libroId ? ` | Libro ${libroId}` : '';

    const disponibles = data.filter((x) => x.estado === 'disponible').length;
    const enUso = data.filter((x) => x.estado === 'usada').length;
    const vencidas = data.filter((x) => x.estado === 'vencida').length;

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const marginX = 30;
    const marginBottom = 30;
    const usableWidth = pageWidth - marginX * 2;

    const incluirAlumno = data.some((x) => x.alumnoId != null);

    const col = incluirAlumno
      ? { idx: 30, clave: 145, libro: 215, estado: 75, alumno: 190, venc: 90 }
      : { idx: 30, clave: 145, libro: 215, estado: 75, venc: 90 };

    const rowH = incluirAlumno ? 20 : 18;
    const headerH = incluirAlumno ? 26 : 22;

    const formatDate = (d: Date | null | undefined) => {
      if (!d) return '—';
      const s = String(d);
      return s.length >= 10 ? s.slice(0, 10) : s;
    };

    const estadoColorBg = (estadoTxt: string) => {
      if (estadoTxt === 'usada') return '#065f46';
      if (estadoTxt === 'vencida') return '#b91c1c';
      return '#0f766e';
    };

    const estadoColorText = () => '#ffffff';

    const trunc = (v: string, maxLen: number) => {
      if (v.length <= maxLen) return v;
      return v.slice(0, Math.max(0, maxLen - 1)) + '…';
    };

    const drawTableHeader = () => {
      const y = doc.y;
      doc.rect(marginX, y, usableWidth, headerH).fill('#f3f4f6').stroke('#e5e7eb');
      doc.fillColor('#111827').fontSize(9).font('Helvetica-Bold');

      const xIdx = marginX + 4;
      const xClave = marginX + col.idx + 8;
      const xLibro = xClave + col.clave;
      const xEstado = xLibro + col.libro;
      const xAlumno = incluirAlumno ? xEstado + col.estado : null;
      const xVenc = incluirAlumno ? xAlumno! + col.alumno : xEstado + col.estado;

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
      const xVenc = incluirAlumno ? xAlumno! + col.alumno : xEstado + col.estado;

      doc.fontSize(8).fillColor('#111827').text(String(lineIdx), xIdx, y + 5, { width: col.idx, align: 'left' });
      doc.text(trunc(String(l.clave), 22), xClave, y + 5, { width: col.clave, align: 'left' });
      doc.text(trunc(String(l.titulo ?? l.libroId), 26), xLibro, y + 5, { width: col.libro, align: 'left' });

      const bg = estadoColorBg(l.estado);
      doc.rect(xEstado, y, col.estado, rowH).fill(bg);
      doc.fillColor(estadoColorText());
      doc.fontSize(8).text(String(l.estado).toUpperCase(), xEstado + 4, y + 6, { width: col.estado - 8, align: 'left' });
      doc.fillColor('#111827');

      if (incluirAlumno) {
        const alumnoTxt = l.alumno ?? (l.alumnoId != null ? String(l.alumnoId) : '—');
        doc.text(trunc(String(alumnoTxt), 24), xAlumno!, y + 5, { width: col.alumno, align: 'left' });
      }
      doc.text(formatDate(l.fechaVencimiento), xVenc, y + 5, { width: col.venc, align: 'left' });

      doc.y = y + rowH;
    };

    doc.fontSize(18).fillColor('#111827').font('Helvetica-Bold').text('Licencias por escuela', { align: 'left' });
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#374151').font('Helvetica');
    doc.text(`Escuela: ${nombreEscuela}`);
    doc.text(`Generado en: ${new Date().toISOString()}`);
    doc.text(`Filtro: ${estadoFiltro}${tituloLibroFiltro}`);
    doc.moveDown(0.4);
    doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold').text(
      `Total: ${data.length} | Disponibles: ${disponibles} | En uso: ${enUso} | Vencidas: ${vencidas}`,
    );

    const resumenPorLibro = new Map<number, { libroId: number; titulo: string; total: number; disponibles: number; enUso: number; vencidas: number }>();
    for (const l of data) {
      const key = Number(l.libroId);
      const item = resumenPorLibro.get(key) ?? { libroId: key, titulo: String(l.titulo ?? key), total: 0, disponibles: 0, enUso: 0, vencidas: 0 };
      item.total += 1;
      if (l.estado === 'disponible') item.disponibles += 1;
      if (l.estado === 'usada') item.enUso += 1;
      if (l.estado === 'vencida') item.vencidas += 1;
      resumenPorLibro.set(key, item);
    }

    const porLibroSorted = Array.from(resumenPorLibro.values()).sort((a, b) => b.total - a.total);
    const maxLibrosRes = 8;
    const porLibroTxt = porLibroSorted
      .slice(0, maxLibrosRes)
      .map((x) => `${trunc(x.titulo, 18)}: ${x.total} (Disp ${x.disponibles}, Uso ${x.enUso}, Venc ${x.vencidas})`)
      .join('\n');

    doc.moveDown(0.25);
    doc.fontSize(9).fillColor('#111827').font('Helvetica-Bold').text('Totales por libro:');
    doc.fontSize(9).fillColor('#374151').font('Helvetica').text(
      porLibroTxt + (porLibroSorted.length > maxLibrosRes ? `\n... (+${porLibroSorted.length - maxLibrosRes} libros)` : ''),
    );

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

    doc.fontSize(9).fillColor('#111827').font('Helvetica');
    const max = 2000;
    const slice = data.slice(0, max);

    drawTableHeader();

    for (let i = 0; i < slice.length; i++) {
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
    return this.listarLibrosDisponiblesUseCase.execute(escuelaId, alumnoId);
  }

  /**
   * Activar/desactivar licencia.
   */
  async setActiva(id: number, activa: boolean) {
    const lic = await this.prisma.licenciaLibro.findUnique({ where: { id: BigInt(id) } });
    if (!lic) throw new NotFoundException(`No se encontró la licencia con ID ${id}`);
    await this.prisma.licenciaLibro.update({ where: { id: BigInt(id) }, data: { activa } });
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
    const lic = await this.prisma.licenciaLibro.findUnique({ where: { id: BigInt(id) } });
    if (!lic) {
      throw new NotFoundException(`No se encontró la licencia con ID ${id}`);
    }
    if (lic.alumnoId != null) {
      throw new BadRequestException(
        'No se puede eliminar una licencia ya canjeada. Solo se pueden eliminar licencias disponibles.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "Licencia_Libro_Archivada"
          (licencia_id, clave, libro_id, escuela_id, alumno_id, fecha_vencimiento, activa, fecha_asignacion, motivo)
        VALUES (${lic.id}, ${lic.clave}, ${lic.libroId}, ${lic.escuelaId}, ${lic.alumnoId}, ${lic.fechaVencimiento}, ${lic.activa}, ${lic.fechaAsignacion}, 'eliminada_admin')
      `;
      await tx.licenciaLibro.delete({ where: { id: lic.id } });
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
   */
  async eliminarLicenciasDisponibles(escuelaId?: number, libroId?: number, cantidad?: number) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const where: Prisma.LicenciaLibroWhereInput = {
      alumnoId: null,
      activa: true,
      fechaVencimiento: { gte: hoy },
    };
    if (escuelaId != null) where.escuelaId = BigInt(escuelaId);
    if (libroId != null) where.libroId = BigInt(libroId);

    const licencias = await this.prisma.licenciaLibro.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      ...(cantidad != null && cantidad > 0 ? { take: Math.min(cantidad, 10000) } : {}),
    });

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

    await this.prisma.$transaction(async (tx) => {
      for (const lic of licencias) {
        await tx.$executeRaw`
          INSERT INTO "Licencia_Libro_Archivada"
            (licencia_id, clave, libro_id, escuela_id, alumno_id, fecha_vencimiento, activa, fecha_asignacion, motivo)
          VALUES (${lic.id}, ${lic.clave}, ${lic.libroId}, ${lic.escuelaId}, ${lic.alumnoId}, ${lic.fechaVencimiento}, ${lic.activa}, ${lic.fechaAsignacion}, 'eliminada_admin')
        `;
        await tx.licenciaLibro.delete({ where: { id: lic.id } });
      }
    });

    const claves = licencias.map((l) => l.clave);
    this.logger.log(
      `Eliminadas ${licencias.length} licencias disponibles (escuela=${escuelaId ?? 'todas'}, libro=${libroId ?? 'todos'})`,
    );
    return {
      message: `Se eliminaron ${licencias.length} licencia(s) correctamente.`,
      description: 'Las licencias se archivaron con motivo "eliminada_admin" para auditoría.',
      eliminadas: licencias.length,
      data: {
        escuelaId: escuelaId ?? null,
        libroId: libroId ?? null,
        clavesEliminadas: claves,
      },
    };
  }
}
