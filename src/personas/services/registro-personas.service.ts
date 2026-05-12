import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RegistroPadreDto } from '../dto/registro-padre.dto';
import { RegistroAlumnoDto } from '../dto/registro-alumno.dto';
import { RegistroMaestroDto } from '../dto/registro-maestro.dto';
import { RegistroDirectorDto } from '../dto/registro-director.dto';
import { RegistroPadreConHijoDto } from '../dto/registro-padre-con-hijo.dto';
import { AuditService } from '../../audit/audit.service';

export interface AuditContext {
  usuarioId?: number | null;
  ip?: string | null;
}

function generarCodigoVinculacion(): string {
  return randomBytes(16).toString('hex');
}

async function crearCodigoVinculacionEnTx(
  alumnoId: bigint,
  tx: { alumnoVinculacionPadre: any },
): Promise<void> {
  const expiraEn = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000);
  try {
    await tx.alumnoVinculacionPadre.create({
      data: { alumnoId, codigo: generarCodigoVinculacion(), usado: false, usadoEn: null, expiraEn },
    });
  } catch {
    await tx.alumnoVinculacionPadre.create({
      data: { alumnoId, codigo: generarCodigoVinculacion(), usado: false, usadoEn: null, expiraEn },
    });
  }
}

@Injectable()
export class RegistroPersonasService {
  private readonly logger = new Logger(RegistroPersonasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async registrarPadre(registroDto: RegistroPadreDto, auditContext?: AuditContext) {
    return await this.prisma.$transaction(async (tx) => {
      const personaExistente = await tx.persona.findFirst({
        where: { correo: registroDto.email },
        select: { id: true },
      });
      if (personaExistente) throw new ConflictException('El email ya está registrado');

      const hashedPassword = await bcrypt.hash(registroDto.password, 10);

      const persona = await tx.persona.create({
        data: {
          nombre: registroDto.nombre,
          apellidoPaterno: registroDto.apellidoPaterno,
          apellidoMaterno: registroDto.apellidoMaterno?.trim() || null,
          correo: registroDto.email,
          password: hashedPassword,
          telefono: registroDto.telefono,
          fechaNacimiento: registroDto.fechaNacimiento ? new Date(registroDto.fechaNacimiento) : null,
          tipoPersona: 'padre',
          activo: true,
        },
      });

      const padre = await tx.padre.create({ data: { personaId: persona.id } });

      if (registroDto.alumnoId != null) {
        const alumno = await tx.alumno.findUnique({ where: { id: BigInt(registroDto.alumnoId) } });
        if (alumno) {
          await tx.alumno.update({ where: { id: alumno.id }, data: { padreId: padre.id } });
          await tx.alumnoVinculacionPadre.updateMany({
            where: { alumnoId: alumno.id, usado: false },
            data: { usado: true, usadoEn: new Date() },
          });
        }
      }

      await this.auditService.log('registro_padre', {
        usuarioId: auditContext?.usuarioId ?? null,
        ip: auditContext?.ip ?? null,
        detalles: persona.correo,
      });

      const resultado = await tx.persona.findUnique({
        where: { id: persona.id },
        include: { padre: true },
      });

      const resultadoSinPassword = { ...(resultado as any) };
      delete resultadoSinPassword.password;

      return {
        message: 'Padre registrado exitosamente',
        description: 'El padre/tutor ha sido creado correctamente. Puede iniciar sesión con su email y contraseña.',
        data: resultadoSinPassword,
      };
    });
  }

  async registrarPadreConHijo(registroDto: RegistroPadreConHijoDto, auditContext?: AuditContext) {
    if (!registroDto?.hijo?.idEscuela) {
      throw new BadRequestException('Debe indicar el ID de la escuela para el alumno (hijo.idEscuela)');
    }

    return await this.prisma.$transaction(async (tx) => {
      const padreDto = registroDto.padre;
      const hijoDto = registroDto.hijo;

      if (await tx.persona.findFirst({ where: { correo: padreDto.email }, select: { id: true } })) {
        throw new ConflictException('El email del padre ya está registrado');
      }
      if (await tx.persona.findFirst({ where: { correo: hijoDto.email }, select: { id: true } })) {
        throw new ConflictException('El email del alumno ya está registrado');
      }

      const escuela = await tx.escuela.findUnique({ where: { id: BigInt(hijoDto.idEscuela!) } });
      if (!escuela) throw new NotFoundException(`No se encontró la escuela con ID ${hijoDto.idEscuela}`);

      let grupoId: bigint | null = null;
      let gradoFinal = hijoDto.grado ? parseInt(hijoDto.grado.toString()) : 1;
      let grupoNombre: string | null = hijoDto.grupo?.trim() || null;

      if (hijoDto.grupoId != null) {
        const g = await tx.grupo.findFirst({
          where: { id: BigInt(hijoDto.grupoId), escuelaId: BigInt(hijoDto.idEscuela!), activo: true },
        });
        if (!g) throw new NotFoundException(`No existe el grupo con ID ${hijoDto.grupoId} en esta escuela`);
        grupoId = g.id;
        gradoFinal = Number(g.grado);
        grupoNombre = g.nombre;
      } else if (hijoDto.grado != null && hijoDto.grupo != null && hijoDto.grupo.trim() !== '') {
        const grupoNorm = hijoDto.grupo.trim().toUpperCase();
        const grupos = await tx.grupo.findMany({
          where: { escuelaId: BigInt(hijoDto.idEscuela!), grado: BigInt(hijoDto.grado), activo: true },
        });
        const g = grupos.find((x) => x.nombre.trim().toUpperCase() === grupoNorm);
        if (!g) throw new BadRequestException(`No existe un grupo con grado ${hijoDto.grado} y nombre "${hijoDto.grupo}".`);
        grupoId = g.id;
        gradoFinal = Number(g.grado);
        grupoNombre = g.nombre;
      }

      const hashedPasswordPadre = await bcrypt.hash(padreDto.password, 10);
      const personaPadre = await tx.persona.create({
        data: {
          nombre: padreDto.nombre,
          apellidoPaterno: padreDto.apellidoPaterno,
          apellidoMaterno: padreDto.apellidoMaterno?.trim() || null,
          correo: padreDto.email,
          password: hashedPasswordPadre,
          telefono: padreDto.telefono,
          fechaNacimiento: padreDto.fechaNacimiento ? new Date(padreDto.fechaNacimiento) : null,
          tipoPersona: 'padre',
          activo: true,
        },
      });
      const padreGuardado = await tx.padre.create({ data: { personaId: personaPadre.id } });

      const hashedPasswordHijo = await bcrypt.hash(hijoDto.password, 10);
      const personaHijo = await tx.persona.create({
        data: {
          nombre: hijoDto.nombre,
          apellidoPaterno: hijoDto.apellidoPaterno,
          apellidoMaterno: hijoDto.apellidoMaterno?.trim() || null,
          correo: hijoDto.email,
          password: hashedPasswordHijo,
          telefono: hijoDto.telefono,
          fechaNacimiento: hijoDto.fechaNacimiento ? new Date(hijoDto.fechaNacimiento) : null,
          tipoPersona: 'alumno',
          activo: true,
        },
      });

      const alumnoGuardado = await tx.alumno.create({
        data: {
          personaId: personaHijo.id,
          escuelaId: BigInt(hijoDto.idEscuela!),
          grado: BigInt(gradoFinal),
          grupo: grupoNombre,
          grupoId,
          cicloEscolar: hijoDto.cicloEscolar || null,
          padreId: padreGuardado.id,
          activo: true,
        },
      });

      await crearCodigoVinculacionEnTx(alumnoGuardado.id, tx);
      await tx.alumnoVinculacionPadre.updateMany({
        where: { alumnoId: alumnoGuardado.id, usado: false },
        data: { usado: true, usadoEn: new Date() },
      });

      await this.auditService.log('registro_padre_con_hijo', {
        usuarioId: auditContext?.usuarioId ?? null,
        ip: auditContext?.ip ?? null,
        detalles: `${padreDto.email} | alumno=${hijoDto.email} | escuelaId=${hijoDto.idEscuela}`,
      });

      const padreResult = await tx.persona.findUnique({
        where: { id: personaPadre.id },
        include: { padre: true },
      });
      const hijoResult = await tx.persona.findUnique({
        where: { id: personaHijo.id },
        include: { alumno: { include: { escuela: true } } },
      });

      const padreSinPassword = { ...(padreResult as any) };
      delete padreSinPassword.password;
      const hijoSinPassword = { ...(hijoResult as any) };
      delete hijoSinPassword.password;

      return {
        message: 'Padre e hijo registrados exitosamente',
        description: 'Los usuarios han sido creados y vinculados correctamente',
        data: { padre: padreSinPassword, hijo: hijoSinPassword },
      };
    });
  }

  async registrarAlumno(registroDto: RegistroAlumnoDto, auditContext?: AuditContext) {
    const resultado = await this.prisma.$transaction(async (tx) => {
      if (await tx.persona.findFirst({ where: { correo: registroDto.email }, select: { id: true } })) {
        throw new ConflictException('El email ya está registrado');
      }
      if (!(await tx.escuela.findUnique({ where: { id: BigInt(registroDto.idEscuela) } }))) {
        throw new NotFoundException(`No se encontró la escuela con ID ${registroDto.idEscuela}`);
      }

      let grupoId: bigint | null = null;
      let gradoFinal = registroDto.grado ? parseInt(registroDto.grado.toString()) : 1;
      let grupoNombre: string | null = registroDto.grupo?.trim() || null;

      if (registroDto.grupoId != null) {
        const g = await tx.grupo.findFirst({
          where: { id: BigInt(registroDto.grupoId), escuelaId: BigInt(registroDto.idEscuela), activo: true },
        });
        if (!g) throw new NotFoundException(`No existe el grupo con ID ${registroDto.grupoId}`);
        grupoId = g.id;
        gradoFinal = Number(g.grado);
        grupoNombre = g.nombre;
      } else if (registroDto.grado != null && registroDto.grupo != null && registroDto.grupo.trim() !== '') {
        const grupoNorm = registroDto.grupo.trim().toUpperCase();
        const grupos = await tx.grupo.findMany({
          where: { escuelaId: BigInt(registroDto.idEscuela!), grado: BigInt(registroDto.grado), activo: true },
        });
        const g = grupos.find((x) => x.nombre.trim().toUpperCase() === grupoNorm);
        if (!g) throw new BadRequestException(`No existe un grupo con grado ${registroDto.grado} y nombre "${registroDto.grupo}".`);
        grupoId = g.id;
        gradoFinal = Number(g.grado);
        grupoNombre = g.nombre;
      }

      const hashedPassword = await bcrypt.hash(registroDto.password, 10);
      const persona = await tx.persona.create({
        data: {
          nombre: registroDto.nombre,
          apellidoPaterno: registroDto.apellidoPaterno,
          apellidoMaterno: registroDto.apellidoMaterno?.trim() || null,
          correo: registroDto.email,
          password: hashedPassword,
          telefono: registroDto.telefono,
          fechaNacimiento: registroDto.fechaNacimiento ? new Date(registroDto.fechaNacimiento) : null,
          tipoPersona: 'alumno',
          activo: true,
        },
      });

      const alumnoGuardado = await tx.alumno.create({
        data: {
          personaId: persona.id,
          escuelaId: BigInt(registroDto.idEscuela),
          grado: BigInt(gradoFinal),
          grupo: grupoNombre,
          grupoId,
          cicloEscolar: registroDto.cicloEscolar || null,
          padreId: null,
        },
      });

      await crearCodigoVinculacionEnTx(alumnoGuardado.id, tx);

      const res = await tx.persona.findUnique({
        where: { id: persona.id },
        include: { alumno: { include: { escuela: true } } },
      });
      const sinPassword = { ...(res as any) };
      delete sinPassword.password;
      return { personaGuardada: persona, resultadoSinPassword: sinPassword };
    });

    await this.auditService.log('registro_alumno', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `${resultado.personaGuardada.correo} | escuelaId: ${registroDto.idEscuela}`,
    });

    return {
      message: 'Alumno registrado exitosamente',
      description: 'El alumno ha sido creado.',
      data: resultado.resultadoSinPassword,
    };
  }

  async registrarMaestro(registroDto: RegistroMaestroDto, auditContext?: AuditContext) {
    const resultado = await this.prisma.$transaction(async (tx) => {
      if (await tx.persona.findFirst({ where: { correo: registroDto.email }, select: { id: true } }))
        throw new ConflictException('El email ya está registrado');
      if (!(await tx.escuela.findUnique({ where: { id: BigInt(registroDto.idEscuela) } })))
        throw new NotFoundException(`No se encontró la escuela con ID ${registroDto.idEscuela}`);

      const hashedPassword = await bcrypt.hash(registroDto.password, 10);
      const persona = await tx.persona.create({
        data: {
          nombre: registroDto.nombre,
          apellidoPaterno: registroDto.apellidoPaterno,
          apellidoMaterno: registroDto.apellidoMaterno?.trim() || null,
          correo: registroDto.email,
          password: hashedPassword,
          telefono: registroDto.telefono,
          fechaNacimiento: registroDto.fechaNacimiento ? new Date(registroDto.fechaNacimiento) : null,
          tipoPersona: 'maestro',
          activo: true,
        },
      });

      await tx.maestro.create({
        data: {
          personaId: persona.id,
          escuelaId: BigInt(registroDto.idEscuela),
          especialidad: registroDto.especialidad,
          fechaContratacion: registroDto.fechaIngreso ? new Date(registroDto.fechaIngreso) : null,
        },
      });

      const res = await tx.persona.findUnique({
        where: { id: persona.id },
        include: { maestro: { include: { escuela: true } } },
      });
      const sinPassword = { ...(res as any) };
      delete sinPassword.password;
      return { personaGuardada: persona, resultadoSinPassword: sinPassword };
    });

    await this.auditService.log('registro_maestro', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `${resultado.personaGuardada.correo} | escuelaId: ${registroDto.idEscuela}`,
    });

    return {
      message: 'Maestro registrado exitosamente',
      description: 'El maestro ha sido creado.',
      data: resultado.resultadoSinPassword,
    };
  }

  async registrarDirector(registroDto: RegistroDirectorDto, auditContext?: AuditContext) {
    const resultado = await this.prisma.$transaction(async (tx) => {
      if (await tx.persona.findFirst({ where: { correo: registroDto.email }, select: { id: true } }))
        throw new ConflictException('El email ya está registrado');
      if (!(await tx.escuela.findUnique({ where: { id: BigInt(registroDto.idEscuela) } })))
        throw new NotFoundException(`No se encontró la escuela con ID ${registroDto.idEscuela}`);

      const cantidadDirectores = await tx.director.count({
        where: { escuelaId: BigInt(registroDto.idEscuela) },
      });
      if (cantidadDirectores >= 3)
        throw new ConflictException('Esta escuela ya tiene el máximo de 3 directores asignados');

      const hashedPassword = await bcrypt.hash(registroDto.password, 10);
      const persona = await tx.persona.create({
        data: {
          nombre: registroDto.nombre,
          apellidoPaterno: registroDto.apellidoPaterno,
          apellidoMaterno: registroDto.apellidoMaterno?.trim() || null,
          correo: registroDto.email,
          password: hashedPassword,
          telefono: registroDto.telefono,
          fechaNacimiento: registroDto.fechaNacimiento ? new Date(registroDto.fechaNacimiento) : null,
          tipoPersona: 'director',
          activo: true,
        },
      });

      await tx.director.create({
        data: {
          personaId: persona.id,
          escuelaId: BigInt(registroDto.idEscuela),
          fechaNombramiento: registroDto.fechaNombramiento
            ? new Date(registroDto.fechaNombramiento)
            : new Date(),
        },
      });

      const res = await tx.persona.findUnique({
        where: { id: persona.id },
        include: { director: { include: { escuela: true } } },
      });
      const sinPassword = { ...(res as any) };
      delete sinPassword.password;
      return { personaGuardada: persona, resultadoSinPassword: sinPassword };
    });

    await this.auditService.log('registro_director', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `${resultado.personaGuardada.correo} | escuelaId: ${registroDto.idEscuela}`,
    });

    return {
      message: 'Director registrado exitosamente',
      description: 'El director ha sido creado.',
      data: resultado.resultadoSinPassword,
    };
  }
}
