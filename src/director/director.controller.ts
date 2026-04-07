import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query, UseGuards, Request, ForbiddenException, BadRequestException, HttpCode, HttpStatus, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody, ApiParam } from '@nestjs/swagger';
import { DirectorGuard } from '../auth/guards/director.guard';
import { DirectorService } from './director.service';
import { EscuelasService } from '../escuelas/escuelas.service';
import { AsignarLibroAlumnoDto } from '../escuelas/dto/asignar-libro-alumno.dto';
import { CrearGrupoDto } from './dto/crear-grupo.dto';
import { ActualizarGrupoDto } from './dto/actualizar-grupo.dto';
import { ActualizarAlumnoGrupoDto } from './dto/actualizar-alumno-grupo.dto';
import { AsignarGrupoMaestroDto } from './dto/asignar-grupo-maestro.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile } from '@nestjs/common';
import * as multer from 'multer';
import { CargaMasivaService } from '../personas/carga-masiva.service';
import { getAuditContext } from '../common/utils/audit.utils';
import type { Request as ExpressRequest } from 'express';

function getEscuelaId(req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } }): number {
  const escuelaId = req.user?.director?.escuelaId ?? req.user?.director?.escuela?.id;
  if (!escuelaId) {
    throw new ForbiddenException('No se encontró la escuela del director');
  }
  return Number(escuelaId);
}

@Controller('director')
@UseGuards(DirectorGuard)
@ApiBearerAuth('JWT-auth')
export class DirectorController {
  constructor(
    private readonly directorService: DirectorService,
    private readonly escuelasService: EscuelasService,
    private readonly cargaMasivaService: CargaMasivaService,
  ) {}

  /**
   * GET /director/dashboard
   * Dashboard con datos de la escuela del director.
   */
  @Get('dashboard')
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Dashboard director: escuela, estudiantes, profesores, libros' })
  @ApiResponse({ status: 200, description: 'Estadísticas de la escuela del director' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async getDashboard(@Request() req: ExpressRequest & { user?: { director?: { escuelaId: number; escuela?: { id: number } } } }) {
    const escuelaId = getEscuelaId(req);
    return await this.directorService.getDashboard(escuelaId);
  }

  /**
   * GET /director/escuela
   * Datos de mi escuela. El ID se obtiene del token; no se envía en la URL.
   */
  @Get('escuela')
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Ver datos de mi escuela', description: 'Sin parámetros. La escuela se toma del token.' })
  @ApiResponse({ status: 200, description: 'Datos de la escuela del director' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async getMiEscuela(@Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } }) {
    const escuelaId = getEscuelaId(req);
    return await this.escuelasService.obtenerPorId(escuelaId);
  }

  /**
   * GET /director/maestros
   * Maestros de mi escuela. El ID de escuela se obtiene del token.
   */
  @Get('maestros')
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Maestros de mi escuela', description: 'Sin parámetros. La escuela se toma del token.' })
  @ApiResponse({ status: 200, description: 'Lista de maestros' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async getMaestros(@Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } }) {
    const escuelaId = getEscuelaId(req);
    return await this.escuelasService.listarMaestrosDeEscuela(escuelaId);
  }

  /**
   * GET /director/alumnos
   * Alumnos de mi escuela. El ID de escuela se obtiene del token.
   */
  @Get('alumnos')
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Alumnos de mi escuela', description: 'Sin parámetros. La escuela se toma del token.' })
  @ApiResponse({ status: 200, description: 'Lista de alumnos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async getAlumnos(@Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } }) {
    const escuelaId = getEscuelaId(req);
    return await this.escuelasService.listarAlumnosDeEscuela(escuelaId);
  }

  /**
   * PATCH /director/alumnos/:id
   * Cambiar el grupo de un alumno. Solo director, alumno de su escuela.
   */
  @Patch('alumnos/:id')
  @ApiTags('Solo Director')
  @ApiOperation({
    summary: 'Cambiar grupo de alumno',
    description: 'Asigna o cambia el grupo de un alumno. Body: { grupoId } (número) o { grupoId: null } para quitar del grupo.',
  })
  @ApiParam({ name: 'id', description: 'ID del alumno' })
  @ApiBody({ type: ActualizarAlumnoGrupoDto, examples: { asignar: { value: { grupoId: 2 } }, quitar: { value: { grupoId: null } } } })
  @ApiResponse({ status: 200, description: 'Grupo del alumno actualizado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Alumno o grupo no encontrado' })
  async actualizarGrupoAlumno(
    @Param('id', ParseIntPipe) alumnoId: number,
    @Body() dto: ActualizarAlumnoGrupoDto,
    @Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } },
  ) {
    const escuelaId = getEscuelaId(req);
    return await this.directorService.actualizarGrupoDeAlumno(escuelaId, alumnoId, dto, getAuditContext(req));
  }

  /**
   * GET /director/grupos
   * Grupos de mi escuela. Solo el director puede crear/gestionar grupos.
   */
  @Get('grupos')
  @ApiTags('Solo Director')
  @ApiOperation({
    summary: 'Listar grupos de mi escuela',
    description: 'Grupos creados por el director para su escuela (ej. 1A, 2B).',
  })
  @ApiResponse({ status: 200, description: 'Lista de grupos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async getGrupos(@Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } }) {
    const escuelaId = getEscuelaId(req);
    return await this.directorService.listarGrupos(escuelaId);
  }

  /**
   * POST /director/grupos
   * Crear grupo en mi escuela.
   */
  @Post('grupos')
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Crear grupo en mi escuela' })
  @ApiResponse({ status: 201, description: 'Grupo creado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  @ApiResponse({ status: 409, description: 'Ya existe un grupo con ese grado y nombre' })
  async crearGrupo(
    @Body() dto: CrearGrupoDto,
    @Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } },
  ) {
    const escuelaId = getEscuelaId(req);
    return await this.directorService.crearGrupo(escuelaId, dto, getAuditContext(req));
  }

  /**
   * PATCH /director/grupos/:id
   * Actualizar grupo de mi escuela. Incluye asignación de maestros con maestroIds.
   */
  @Patch('grupos/:id')
  @ApiTags('Solo Director')
  @ApiOperation({
    summary: 'Actualizar grupo',
    description: 'Actualiza grado, nombre, activo. Opcional: maestroIds para asignar maestros al grupo (reemplaza la lista actual).',
  })
  @ApiBody({
    type: ActualizarGrupoDto,
    description: 'Campos opcionales. maestroIds: array de IDs de maestros a asignar.',
    examples: {
      soloNombre: { summary: 'Solo cambiar nombre', value: { nombre: 'A1' } },
      asignarMaestros: { summary: 'Asignar maestros', value: { maestroIds: [5, 7] } },
      todo: { summary: 'Todo', value: { grado: 1, nombre: 'A', activo: true, maestroIds: [5] } },
    },
  })
  @ApiResponse({ status: 200, description: 'Grupo actualizado (incluye maestros)' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado o grupo de otra escuela' })
  @ApiResponse({ status: 404, description: 'Grupo no encontrado' })
  @ApiResponse({ status: 409, description: 'Conflicto: ya existe grupo con grado/nombre' })
  async actualizarGrupo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarGrupoDto,
    @Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } },
  ) {
    const escuelaId = getEscuelaId(req);
    return await this.directorService.actualizarGrupo(escuelaId, id, dto, getAuditContext(req));
  }

  /**
   * DELETE /director/grupos/:id
   * Eliminar grupo de mi escuela.
   */
  @Delete('grupos/:id')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Eliminar grupo' })
  @ApiResponse({ status: 200, description: 'Grupo eliminado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado o grupo de otra escuela' })
  @ApiResponse({ status: 404, description: 'Grupo no encontrado' })
  async eliminarGrupo(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } },
  ) {
    const escuelaId = getEscuelaId(req);
    return await this.directorService.eliminarGrupo(escuelaId, id, getAuditContext(req));
  }

  /**
   * GET /director/maestros/:maestroId/grupos
   * Grupos asignados a un maestro.
   */
  @Get('maestros/:maestroId/grupos')
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Grupos asignados a un maestro' })
  @ApiResponse({ status: 200, description: 'Lista de grupos del maestro' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  @ApiResponse({ status: 404, description: 'Maestro no encontrado' })
  async getGruposDeMaestro(
    @Param('maestroId', ParseIntPipe) maestroId: number,
    @Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } },
  ) {
    const escuelaId = getEscuelaId(req);
    return await this.directorService.listarGruposDeMaestro(escuelaId, maestroId);
  }

  /**
   * POST /director/maestros/asignar-grupo
   * Asignar un grupo a un maestro.
   */
  @Post('maestros/asignar-grupo')
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Asignar grupo a maestro' })
  @ApiResponse({ status: 201, description: 'Grupo asignado al maestro' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  @ApiResponse({ status: 404, description: 'Maestro o grupo no encontrado' })
  @ApiResponse({ status: 409, description: 'El maestro ya tiene asignado este grupo' })
  async asignarGrupoAMaestro(
    @Body() dto: AsignarGrupoMaestroDto,
    @Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } },
  ) {
    const escuelaId = getEscuelaId(req);
    return await this.directorService.asignarGrupoAMaestro(escuelaId, dto.maestroId, dto.grupoId, getAuditContext(req));
  }

  /**
   * DELETE /director/maestros/desasignar-grupo/:maestroId/:grupoId
   * Desasignar un grupo de un maestro.
   */
  @Delete('maestros/desasignar-grupo/:maestroId/:grupoId')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Desasignar grupo de maestro' })
  @ApiResponse({ status: 200, description: 'Grupo desasignado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  @ApiResponse({ status: 404, description: 'Maestro o asignación no encontrada' })
  async desasignarGrupoDeMaestro(
    @Param('maestroId', ParseIntPipe) maestroId: number,
    @Param('grupoId', ParseIntPipe) grupoId: number,
    @Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } },
  ) {
    const escuelaId = getEscuelaId(req);
    return await this.directorService.desasignarGrupoDeMaestro(escuelaId, maestroId, grupoId, getAuditContext(req));
  }

  /**
   * GET /director/directores
   * Directores de mi escuela. El ID de escuela se obtiene del token.
   */
  @Get('directores')
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Directores de mi escuela', description: 'Sin parámetros. La escuela se toma del token.' })
  @ApiResponse({ status: 200, description: 'Lista de directores de la escuela' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async getDirectores(@Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } }) {
    const escuelaId = getEscuelaId(req);
    return await this.escuelasService.listarDirectoresDeEscuela(escuelaId);
  }

  /**
   * GET /director/libros
   * Libros activos de la escuela del director (sin enviar ID de escuela).
   */
  @Get('libros')
  @ApiTags('Solo Director')
  @ApiOperation({
    summary: 'Libros activos de mi escuela',
    description: 'Sin parámetros. La escuela se toma del token del director. No se envía ID de escuela.',
  })
  @ApiResponse({ status: 200, description: 'Libros ya canjeados en mi escuela' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async getLibros(@Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } }) {
    const escuelaId = getEscuelaId(req);
    return await this.escuelasService.listarLibrosDeEscuela(escuelaId);
  }

  /**
   * POST /director/carga-masiva
   * Carga masiva de alumnos o maestros desde Excel. Usa la escuela del director.
   */
  @Post('carga-masiva')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiTags('Solo Director')
  @ApiOperation({
    summary: 'Carga masiva desde Excel',
    description: 'Sube Excel con: nombre, apellidoPaterno, apellidoMaterno, email, [password], [grado], [grupo]. Tipo: alumno o maestro.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'tipo'],
      properties: {
        file: { type: 'string', format: 'binary' },
        tipo: { type: 'string', enum: ['alumno', 'maestro'] },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Creados, errores, credenciales, excelBase64' })
  @ApiResponse({ status: 400, description: 'Archivo o tipo inválido' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async cargaMasiva(
    @UploadedFile() file: { buffer: Buffer },
    @Body() body: { tipo?: string },
    @Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } },
  ) {
    const escuelaId = getEscuelaId(req);
    if (!file?.buffer) throw new BadRequestException('Debes enviar un archivo Excel (campo "file").');
    const tipoNorm = (body?.tipo || 'alumno').toLowerCase();
    if (tipoNorm !== 'alumno' && tipoNorm !== 'maestro') {
      throw new BadRequestException('El tipo debe ser "alumno" o "maestro".');
    }

    const filas =
      tipoNorm === 'alumno'
        ? this.cargaMasivaService.parseExcelAlumnos(file.buffer)
        : this.cargaMasivaService.parseExcelMaestros(file.buffer);

    if (filas.length === 0) {
      throw new BadRequestException(
        'El Excel está vacío o no tiene el formato correcto. Obligatorias: nombre, email (o correo). Opcionales: apellidoPaterno, apellidoMaterno, password (si no se envía se genera automática).',
      );
    }

    const resultado =
      tipoNorm === 'alumno'
        ? await this.cargaMasivaService.cargarAlumnos(escuelaId, filas, getAuditContext(req))
        : await this.cargaMasivaService.cargarMaestros(escuelaId, filas, getAuditContext(req));

    const excelBase64 =
      resultado.credenciales.length > 0
        ? (await this.cargaMasivaService.generarExcelCredenciales(resultado.credenciales)).toString('base64')
        : null;

    return {
      message: `Carga masiva completada. Creados: ${resultado.credenciales.length}, errores: ${resultado.errores.length}`,
      creados: resultado.credenciales.length,
      totalErrores: resultado.errores.length,
      credenciales: resultado.credenciales,
      detalleErrores: resultado.errores,
      excelBase64,
    };
  }

  /**
   * GET /director/libros-disponibles-para-asignar
   * Libros disponibles para asignar a un alumno (mismo grado, grupo).
   */
  @Get('libros-disponibles-para-asignar')
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Libros disponibles para asignar a un alumno' })
  @ApiResponse({ status: 200, description: 'Libros que coinciden con grado y grupo del alumno' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async librosDisponiblesParaAsignar(
    @Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } },
    @Query('alumnoId') alumnoIdStr: string,
  ) {
    const escuelaId = getEscuelaId(req);
    const alumnoId = parseInt(alumnoIdStr, 10);
    if (isNaN(alumnoId)) throw new ForbiddenException('alumnoId debe ser un número');
    return await this.escuelasService.listarLibrosDisponiblesParaAsignar(escuelaId, alumnoId);
  }

  /**
   * POST /director/asignar-libro
   * Asignar un libro a un alumno.
   */
  @Post('asignar-libro')
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Asignar libro a alumno' })
  @ApiResponse({ status: 201, description: 'Libro asignado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o libro no disponible' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  @ApiResponse({ status: 404, description: 'Alumno o libro no encontrados' })
  @ApiResponse({ status: 409, description: 'Libro ya asignado al alumno' })
  async asignarLibro(
    @Body() dto: AsignarLibroAlumnoDto,
    @Request() req: ExpressRequest & { user?: { director?: { id: number; escuelaId?: number; escuela?: { id: number } } } },
  ) {
    const escuelaId = getEscuelaId(req);
    const directorId = req.user?.director?.id;
    if (!directorId) throw new ForbiddenException('No se encontró el director');
    return await this.escuelasService.asignarLibroAlAlumno(
      escuelaId,
      dto.alumnoId,
      dto.libroId,
      'director',
      directorId,
      getAuditContext(req),
    );
  }

  /**
   * DELETE /director/desasignar-libro/:alumnoId/:libroId
   * Desasignar un libro de un alumno.
   */
  @Delete('desasignar-libro/:alumnoId/:libroId')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Desasignar libro de alumno' })
  @ApiResponse({ status: 200, description: 'Libro desasignado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  @ApiResponse({ status: 404, description: 'Asignación no encontrada' })
  async desasignarLibro(
    @Param('alumnoId', ParseIntPipe) alumnoId: number,
    @Param('libroId', ParseIntPipe) libroId: number,
    @Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } },
  ) {
    const escuelaId = getEscuelaId(req);
    return await this.escuelasService.desasignarLibroAlAlumno(alumnoId, libroId, {
      escuelaIdRestriccion: escuelaId,
      auditContext: getAuditContext(req),
    });
  }
}
