import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LibroProcesamientoService } from '../libros/libro-procesamiento.service';
import {
  LIBROS_IMPORT_QUEUE,
  LOCK_LIBRO_IMPORT_PREFIX,
  libroImportLockTtlSec,
} from './libros-import.constants';
import type { LibrosImportJobPayload } from './interfaces/libros-import-job.interface';
import { LIBRO_ESTADO } from '../libros/constants/libro-estado.constants';
import { RedisService } from '../infra/redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { getLibrosImportTracer, runWithJobTraceContext } from '../infra/telemetry/trace-context';
import { SupabaseStorageService } from '../libros/supabase-storage.service';

@Processor(LIBROS_IMPORT_QUEUE, {
  concurrency: Number(process.env.LIBROS_IMPORT_WORKER_CONCURRENCY ?? 2),
})
export class LibrosImportProcessor extends WorkerHost {
  private readonly logger = new Logger(LibrosImportProcessor.name);

  constructor(
    private readonly libroProcesamiento: LibroProcesamientoService,
    private readonly supabaseStorage: SupabaseStorageService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {
    super();
  }

  async process(job: Job<LibrosImportJobPayload>): Promise<void> {
    return runWithJobTraceContext(job.data.traceContext, async () => {
      const tracer = getLibrosImportTracer();
      return tracer.startActiveSpan('libros-import.process', async (span) => {
        span.setAttribute('libro.id', job.data.libroId);
        try {
          await this.runImport(job);
        } finally {
          span.end();
        }
      });
    });
  }

  private async runImport(job: Job<LibrosImportJobPayload>): Promise<void> {
    const { libroId, codigo, rutaPdfRelativa, auditContext } = job.data;
    const lockKey = `${LOCK_LIBRO_IMPORT_PREFIX}${libroId}`;
    const lockTtl = libroImportLockTtlSec();

    const locked = await this.redis.acquireLock(lockKey, lockTtl);
    if (!locked) {
      this.logger.warn(`Job ${job.id}: lock activo para libro ${libroId}, reintento más tarde.`);
      throw new Error(
        `[libro-import] lock not acquired for libro=${libroId} (otro worker o job en curso)`,
      );
    }

    try {
      const libro = await this.prisma.libro.findUnique({
        where: { id: BigInt(libroId) },
        include: { unidades: true },
      });

      if (!libro) {
        throw new Error(`Libro ${libroId} no existe`);
      }

      if (libro.estado === LIBRO_ESTADO.LISTO && (libro.unidades?.length ?? 0) > 0) {
        this.logger.log(`Libro ${libroId} ya listo (idempotencia), omitiendo.`);
        return;
      }

      const buffer = await this.supabaseStorage.descargarArchivo(rutaPdfRelativa);

      const resultado = await this.libroProcesamiento.procesar({
        buffer,
        libroId,
        codigo,
        usarUnidadesReales: true,
        rutaPdfPreexistente: rutaPdfRelativa,
      });

      const final = await this.prisma.libro.findUnique({
        where: { id: BigInt(libroId) },
        include: { materia: true, unidades: true },
      });

      await this.auditService.log('libro_cargar', {
        usuarioId: auditContext?.usuarioId ?? null,
        ip: auditContext?.ip ?? null,
        detalles: `${final!.titulo} (id: ${final!.id}, codigo: ${codigo}) [async]`,
      });

      this.logger.log(`Libro ${libroId} OK job=${job.id} segmentos=${resultado.numSegmentos}`);
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      await this.libroProcesamiento.marcarError(libroId, msg);
      this.logger.error(`Libro ${libroId} falló: ${msg}`);
      throw e;
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }
}
