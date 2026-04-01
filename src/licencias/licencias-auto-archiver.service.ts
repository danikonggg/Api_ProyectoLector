import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LicenciasService } from './licencias.service';

/**
 * Archiva licencias vencidas periódicamente para:
 * 1) moverlas a la tabla histórica
 * 2) eliminarlas de la tabla activa
 *
 * Nota: No usamos @nestjs/schedule para evitar dependencias nuevas.
 */
@Injectable()
export class LicenciasAutoArchiverService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LicenciasAutoArchiverService.name);
  private intervalHandle?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly licenciasService: LicenciasService) {}

  onModuleInit() {
    const raw = process.env.LICENCIAS_AUTO_ARCHIVAR_INTERVAL_MS;
    const intervalMs = raw ? Number(raw) : 60 * 60 * 1000; // 1h por defecto
    const safeIntervalMs = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 60 * 60 * 1000;

    // Primer intento inmediato (opcional).
    void this.runOnce();

    this.intervalHandle = setInterval(() => {
      void this.runOnce();
    }, safeIntervalMs);

    this.logger.log(`Auto-archiver de licencias activo. Interval=${safeIntervalMs}ms`);
  }

  onModuleDestroy() {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
  }

  private async runOnce() {
    if (this.running) return;
    this.running = true;
    try {
      await this.licenciasService.archivarLicenciasVencidas();
    } catch (err: any) {
      this.logger.error(`Error archivando licencias vencidas: ${err?.message ?? String(err)}`);
    } finally {
      this.running = false;
    }
  }
}

