import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomBytes } from 'crypto';
import { Alumno } from '../entities/alumno.entity';
import { Padre } from '../entities/padre.entity';
import { AlumnoVinculacionPadre } from '../entities/alumno-vinculacion-padre.entity';

@Injectable()
export class VinculacionPadresService {
  private readonly logger = new Logger(VinculacionPadresService.name);

  constructor(
    @InjectRepository(Alumno)
    private readonly alumnoRepository: Repository<Alumno>,
    @InjectRepository(Padre)
    private readonly padreRepository: Repository<Padre>,
    @InjectRepository(AlumnoVinculacionPadre)
    private readonly alumnoVinculacionPadreRepository: Repository<AlumnoVinculacionPadre>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async obtenerCodigoVinculacionAlumno(id: number): Promise<{
    message: string;
    description: string;
    data: { codigo: string; expiraEn: Date | null; usado: boolean };
  }> {
    return await this.dataSource.transaction(async (manager) => {
      const alumnoRepo = manager.getRepository(Alumno);
      const alumnoVinculacionRepo = manager.getRepository(AlumnoVinculacionPadre);

      let alumno = await alumnoRepo.findOne({
        where: { id },
        select: ['id', 'personaId', 'escuelaId'],
      });

      if (!alumno) {
        alumno = await alumnoRepo.findOne({
          where: { personaId: id },
          select: ['id', 'personaId', 'escuelaId'],
        });
      }

      if (!alumno) {
        throw new NotFoundException(`No se encontró el alumno (ID alumno o persona: ${id})`);
      }

      const ahora = new Date();
      const codigoActivo = await alumnoVinculacionRepo.findOne({
        where: { alumnoId: alumno.id, usado: false },
        order: { creadoEn: 'DESC' },
      });

      const esVigente =
        !!codigoActivo &&
        (!codigoActivo.expiraEn || codigoActivo.expiraEn.getTime() >= ahora.getTime());

      const vinculoFinal = esVigente
        ? codigoActivo!
        : await this.crearCodigoVinculacionParaAlumnoTransactional(
            alumno.id,
            alumnoVinculacionRepo,
          );

      return {
        message: 'Código de vinculación obtenido correctamente',
        description: 'El código de vinculación del alumno fue validado',
        data: {
          codigo: vinculoFinal.codigo,
          expiraEn: vinculoFinal.expiraEn,
          usado: vinculoFinal.usado,
        },
      };
    });
  }

  async obtenerCodigoVinculacionParaPadre(padreId: number): Promise<{
    message: string;
    description: string;
    data: { codigo: string; expiraEn: Date | null; usado: boolean };
  }> {
    const padre = await this.padreRepository.findOne({
      where: { id: padreId },
      relations: ['alumnos'],
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

    const vinculo = await this.alumnoVinculacionPadreRepository.findOne({
      where: { codigo, usado: false },
      order: { creadoEn: 'DESC' },
    });

    if (!vinculo) throw new BadRequestException('Código inválido o ya utilizado');
    if (vinculo.expiraEn && vinculo.expiraEn.getTime() < ahora.getTime()) {
      throw new BadRequestException('El código ha expirado, solicita uno nuevo en la escuela');
    }

    const alumno = await this.alumnoRepository.findOne({ where: { id: vinculo.alumnoId } });
    if (!alumno) throw new NotFoundException('El alumno asociado a este código ya no existe');

    alumno.padreId = padreId;
    await this.alumnoRepository.save(alumno);

    vinculo.usado = true;
    vinculo.usadoEn = ahora;
    await this.alumnoVinculacionPadreRepository.save(vinculo);

    return {
      message: 'Alumno vinculado correctamente al padre',
      description: 'El código ha sido validado y ya no podrá volver a utilizarse.',
      data: { alumnoId: alumno.id, padreId },
    };
  }

  async desvincularAlumnoDelPadre(padreId: number, alumnoId: number) {
    const alumno = await this.alumnoRepository.findOne({ where: { id: alumnoId } });

    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    if (alumno.padreId !== padreId)
      throw new ForbiddenException(
        'Solo puedes desvincular alumnos que están vinculados a tu cuenta',
      );

    alumno.padreId = null;
    await this.alumnoRepository.save(alumno);

    return {
      message: 'Alumno desvinculado correctamente',
      description: 'El alumno ya no está asociado a tu cuenta como tutor.',
      data: { alumnoId: alumno.id },
    };
  }

  async crearCodigoVinculacionParaAlumnoTransactional(
    alumnoId: number,
    repo: Repository<AlumnoVinculacionPadre>,
  ): Promise<AlumnoVinculacionPadre> {
    const codigo = this.generarCodigoVinculacion();
    const ahora = new Date();
    const expiraEn = new Date(ahora.getTime() + 100 * 24 * 60 * 60 * 1000);

    const entidad = repo.create({ alumnoId, codigo, usado: false, usadoEn: null, expiraEn });

    try {
      return await repo.save(entidad);
    } catch (e) {
      const entidadRetry = repo.create({
        alumnoId,
        codigo: this.generarCodigoVinculacion(),
        usado: false,
        usadoEn: null,
        expiraEn,
      });
      return await repo.save(entidadRetry);
    }
  }

  generarCodigoVinculacion(): string {
    return randomBytes(16).toString('hex');
  }
}
