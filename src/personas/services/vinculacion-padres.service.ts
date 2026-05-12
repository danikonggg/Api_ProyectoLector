import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VinculacionPadresService {
  private readonly logger = new Logger(VinculacionPadresService.name);

  constructor(private readonly prisma: PrismaService) {}

  async obtenerCodigoVinculacionAlumno(id: number): Promise<{
    message: string;
    description: string;
    data: { codigo: string; expiraEn: Date | null; usado: boolean };
  }> {
    let alumno = await this.prisma.alumno.findUnique({
      where: { id: BigInt(id) },
      select: { id: true, personaId: true, escuelaId: true },
    });

    if (!alumno) {
      alumno = await this.prisma.alumno.findUnique({
        where: { personaId: BigInt(id) },
        select: { id: true, personaId: true, escuelaId: true },
      });
    }

    if (!alumno) {
      throw new NotFoundException(`No se encontró el alumno (ID alumno o persona: ${id})`);
    }

    const ahora = new Date();
    const codigoActivo = await this.prisma.alumnoVinculacionPadre.findFirst({
      where: { alumnoId: alumno.id, usado: false },
      orderBy: { creadoEn: 'desc' },
    });

    const esVigente =
      !!codigoActivo &&
      (!codigoActivo.expiraEn || codigoActivo.expiraEn.getTime() >= ahora.getTime());

    const vinculoFinal = esVigente
      ? codigoActivo!
      : await this.crearCodigoVinculacion(alumno.id);

    return {
      message: 'Código de vinculación obtenido correctamente',
      description: 'El código de vinculación del alumno fue validado',
      data: {
        codigo: vinculoFinal.codigo,
        expiraEn: vinculoFinal.expiraEn,
        usado: vinculoFinal.usado,
      },
    };
  }

  async obtenerCodigoVinculacionParaPadre(padreId: number): Promise<{
    message: string;
    description: string;
    data: { codigo: string; expiraEn: Date | null; usado: boolean };
  }> {
    const padre = await this.prisma.padre.findUnique({
      where: { id: BigInt(padreId) },
      include: { alumnos: true },
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

  async vincularAlumnoConPadrePorCodigo(padreId: number, codigo: string) {
    const ahora = new Date();

    const vinculo = await this.prisma.alumnoVinculacionPadre.findFirst({
      where: { codigo, usado: false },
      orderBy: { creadoEn: 'desc' },
    });

    if (!vinculo) throw new BadRequestException('Código inválido o ya utilizado');
    if (vinculo.expiraEn && vinculo.expiraEn.getTime() < ahora.getTime()) {
      throw new BadRequestException('El código ha expirado, solicita uno nuevo en la escuela');
    }

    const alumno = await this.prisma.alumno.findUnique({ where: { id: vinculo.alumnoId } });
    if (!alumno) throw new NotFoundException('El alumno asociado a este código ya no existe');

    await this.prisma.alumno.update({
      where: { id: alumno.id },
      data: { padreId: BigInt(padreId) },
    });

    await this.prisma.alumnoVinculacionPadre.update({
      where: { id: vinculo.id },
      data: { usado: true, usadoEn: ahora },
    });

    return {
      message: 'Alumno vinculado correctamente al padre',
      description: 'El código ha sido validado y ya no podrá volver a utilizarse.',
      data: { alumnoId: Number(alumno.id), padreId },
    };
  }

  async desvincularAlumnoDelPadre(padreId: number, alumnoId: number) {
    const alumno = await this.prisma.alumno.findUnique({ where: { id: BigInt(alumnoId) } });

    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    if (Number(alumno.padreId) !== padreId)
      throw new ForbiddenException(
        'Solo puedes desvincular alumnos que están vinculados a tu cuenta',
      );

    await this.prisma.alumno.update({
      where: { id: alumno.id },
      data: { padreId: null },
    });

    return {
      message: 'Alumno desvinculado correctamente',
      description: 'El alumno ya no está asociado a tu cuenta como tutor.',
      data: { alumnoId: Number(alumno.id) },
    };
  }

  async crearCodigoVinculacion(
    alumnoId: bigint,
    tx?: { alumnoVinculacionPadre: typeof this.prisma.alumnoVinculacionPadre },
  ): Promise<{ codigo: string; expiraEn: Date | null; usado: boolean }> {
    const client = tx ?? this.prisma;
    const ahora = new Date();
    const expiraEn = new Date(ahora.getTime() + 100 * 24 * 60 * 60 * 1000);

    try {
      return await client.alumnoVinculacionPadre.create({
        data: { alumnoId, codigo: this.generarCodigoVinculacion(), usado: false, usadoEn: null, expiraEn },
      });
    } catch {
      return await client.alumnoVinculacionPadre.create({
        data: { alumnoId, codigo: this.generarCodigoVinculacion(), usado: false, usadoEn: null, expiraEn },
      });
    }
  }

  generarCodigoVinculacion(): string {
    return randomBytes(16).toString('hex');
  }
}
