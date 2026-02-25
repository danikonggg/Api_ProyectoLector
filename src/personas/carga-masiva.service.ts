/**
 * ============================================
 * SERVICIO: CargaMasivaService
 * ============================================
 * Carga masiva de usuarios (alumnos, maestros) desde Excel.
 * Genera credenciales y devuelve Excel con las mismas.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Persona } from './entities/persona.entity';
import { Alumno } from './entities/alumno.entity';
import { Maestro } from './entities/maestro.entity';
import { Escuela } from './entities/escuela.entity';
import { AuditService } from '../audit/audit.service';
import type { AuditContext } from './personas.service';

export interface FilaAlumno {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  email: string;
  password?: string;
  grado?: number;
  grupo?: string;
  cicloEscolar?: string;
}

export interface FilaMaestro {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  email: string;
  password?: string;
  especialidad?: string;
}

export interface ResultadoCarga {
  creados: number;
  errores: { fila: number; email?: string; mensaje: string }[];
  credenciales: { nombre: string; apellido: string; email: string; password: string; tipo: string }[];
}

const CHARS_PASSWORD = 'abcdefghjkmnpqrstuvwxyz23456789';

function generarPassword(longitud = 8): string {
  let s = '';
  for (let i = 0; i < longitud; i++) {
    s += CHARS_PASSWORD[Math.floor(Math.random() * CHARS_PASSWORD.length)];
  }
  return s;
}

function normalizarHeader(h: string): string {
  if (!h || typeof h !== 'string') return '';
  return h
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/á/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u');
}

/** Busca índice de columna probando varios alias (ej: email/correo) */
function buscarColumna(headers: string[], nombres: string[]): number {
  for (const n of nombres) {
    const idx = headers.findIndex((h) => h === n || h === n.replace(/\s/g, ''));
    if (idx >= 0) return idx;
  }
  return -1;
}

@Injectable()
export class CargaMasivaService {
  private readonly logger = new Logger(CargaMasivaService.name);

  /** Detecta la fila de encabezados (por si hay título/instrucciones arriba en la plantilla) */
  private detectarFilaEncabezados(
    rows: any[][],
    columnasRequeridas: string[],
  ): { headerRowIndex: number; headers: string[] } {
    for (let r = 0; r < Math.min(5, rows.length); r++) {
      const row = rows[r] as any[];
      const headers = (row || []).map((h: any) => normalizarHeader(String(h ?? '')));
      const tieneNombre = headers.some((h) => h === 'nombre');
      const tieneEmailOCorreo = headers.some((h) => h === 'email' || h === 'correo');
      if (tieneNombre && tieneEmailOCorreo) {
        return { headerRowIndex: r, headers };
      }
    }
    return { headerRowIndex: -1, headers: [] };
  }

  constructor(
    @InjectRepository(Persona)
    private readonly personaRepository: Repository<Persona>,
    @InjectRepository(Alumno)
    private readonly alumnoRepository: Repository<Alumno>,
    @InjectRepository(Maestro)
    private readonly maestroRepository: Repository<Maestro>,
    @InjectRepository(Escuela)
    private readonly escuelaRepository: Repository<Escuela>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Parsea un Excel y extrae filas como alumnos.
   * Columnas esperadas: nombre, apellidopaterno, apellidomaterno, email, password (opc), grado (opc), grupo (opc), cicloescolar (opc)
   */
  parseExcelAlumnos(buffer: Buffer): FilaAlumno[] {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sh = wb.Sheets[wb.SheetNames[0]];
    if (!sh) return [];
    const rows = XLSX.utils.sheet_to_json<any[]>(sh, { header: 1, defval: '' });
    if (rows.length < 2) return [];

    const { headerRowIndex, headers } = this.detectarFilaEncabezados(rows, ['nombre', 'email', 'correo']);
    if (headerRowIndex < 0) return [];
    const map: Record<string, number> = {};
    const idxNombre = buscarColumna(headers, ['nombre']);
    const idxApellidoP = buscarColumna(headers, ['apellidopaterno', 'apellido']);
    const idxApellidoM = buscarColumna(headers, ['apellidomaterno']);
    const idxEmail = buscarColumna(headers, ['email', 'correo']);
    map['nombre'] = idxNombre;
    map['apellidopaterno'] = idxApellidoP >= 0 ? idxApellidoP : idxNombre;
    map['apellidomaterno'] = idxApellidoM;
    map['email'] = idxEmail;
    ;['password', 'grado', 'grupo', 'cicloescolar'].forEach((k) => {
      const idx = buscarColumna(headers, [k]);
      if (idx >= 0) map[k] = idx;
    });

    const result: FilaAlumno[] = [];
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i] as any[];
      const nombre = map['nombre'] >= 0 ? String(row[map['nombre']] ?? '').trim() : '';
      const email = map['email'] >= 0 ? String(row[map['email']] ?? '').trim().toLowerCase() : '';
      if (!nombre || !email) continue;

      const gradoVal = (map['grado'] ?? -1) >= 0 ? row[map['grado']] : undefined;
      let grado: number | undefined;
      if (gradoVal != null && gradoVal !== '') {
        const n = Number(gradoVal);
        grado = Number.isInteger(n) ? n : 1;
      }

      const apellidoP = map['apellidopaterno'] >= 0 ? String(row[map['apellidopaterno']] ?? '').trim() : nombre;
      result.push({
        nombre,
        apellidoPaterno: apellidoP || nombre,
        apellidoMaterno: map['apellidomaterno'] >= 0 ? String(row[map['apellidomaterno']] ?? '').trim() : '',
        email,
        password: map['password'] >= 0 ? String(row[map['password']] ?? '').trim() || undefined : undefined,
        grado,
        grupo: map['grupo'] >= 0 ? String(row[map['grupo']] ?? '').trim() || undefined : undefined,
        cicloEscolar: map['cicloescolar'] >= 0 ? String(row[map['cicloescolar']] ?? '').trim() || undefined : undefined,
      });
    }
    return result;
  }

  /**
   * Parsea un Excel y extrae filas como maestros.
   */
  parseExcelMaestros(buffer: Buffer): FilaMaestro[] {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sh = wb.Sheets[wb.SheetNames[0]];
    if (!sh) return [];
    const rows = XLSX.utils.sheet_to_json<any[]>(sh, { header: 1, defval: '' });
    if (rows.length < 2) return [];

    const { headerRowIndex, headers } = this.detectarFilaEncabezados(rows, ['nombre', 'email', 'correo']);
    if (headerRowIndex < 0) return [];
    const map: Record<string, number> = {};
    const idxNombre = buscarColumna(headers, ['nombre']);
    const idxApellidoP = buscarColumna(headers, ['apellidopaterno', 'apellido']);
    const idxApellidoM = buscarColumna(headers, ['apellidomaterno']);
    const idxEmail = buscarColumna(headers, ['email', 'correo']);
    map['nombre'] = idxNombre;
    map['apellidopaterno'] = idxApellidoP >= 0 ? idxApellidoP : idxNombre;
    map['apellidomaterno'] = idxApellidoM;
    map['email'] = idxEmail;
    ;['password', 'especialidad'].forEach((k) => {
      const idx = buscarColumna(headers, [k]);
      if (idx >= 0) map[k] = idx;
    });

    const result: FilaMaestro[] = [];
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i] as any[];
      const nombre = map['nombre'] >= 0 ? String(row[map['nombre']] ?? '').trim() : '';
      const email = map['email'] >= 0 ? String(row[map['email']] ?? '').trim().toLowerCase() : '';
      if (!nombre || !email) continue;

      const apellidoP = map['apellidopaterno'] >= 0 ? String(row[map['apellidopaterno']] ?? '').trim() : nombre;
      result.push({
        nombre,
        apellidoPaterno: apellidoP || nombre,
        apellidoMaterno: map['apellidomaterno'] >= 0 ? String(row[map['apellidomaterno']] ?? '').trim() : '',
        email,
        password: map['password'] >= 0 ? String(row[map['password']] ?? '').trim() || undefined : undefined,
        especialidad: map['especialidad'] >= 0 ? String(row[map['especialidad']] ?? '').trim() || undefined : undefined,
      });
    }
    return result;
  }

  /**
   * Carga masiva de alumnos en una escuela.
   */
  async cargarAlumnos(
    escuelaId: number,
    filas: FilaAlumno[],
    auditContext?: AuditContext,
  ): Promise<ResultadoCarga> {
    const escuela = await this.escuelaRepository.findOne({ where: { id: escuelaId } });
    if (!escuela) throw new Error('Escuela no encontrada');

    const credenciales: ResultadoCarga['credenciales'] = [];
    const errores: ResultadoCarga['errores'] = [];
    let creados = 0;

    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      const filaNum = i + 2;

      const email = f.email?.trim().toLowerCase();
      if (!email) {
        errores.push({ fila: filaNum, mensaje: 'Email vacío' });
        continue;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errores.push({ fila: filaNum, email, mensaje: 'Email inválido' });
        continue;
      }

      let password = f.password?.trim();
      if (!password || password.length < 6) {
        password = generarPassword(8);
      }

      const existente = await this.personaRepository.findOne({ where: { correo: email } });
      if (existente) {
        errores.push({ fila: filaNum, email, mensaje: 'Email ya registrado' });
        continue;
      }

      try {
        const hashed = await bcrypt.hash(password, 10);
        const persona = this.personaRepository.create({
          nombre: f.nombre,
          apellidoPaterno: f.apellidoPaterno || f.nombre,
          apellidoMaterno: f.apellidoMaterno?.trim() || null,
          correo: email,
          password: hashed,
          tipoPersona: 'alumno',
          activo: true,
        });
        const personaGuardada = await this.personaRepository.save(persona);

        const alumno = this.alumnoRepository.create({
          personaId: personaGuardada.id,
          escuelaId,
          grado: f.grado ?? 1,
          grupo: f.grupo ?? null,
          cicloEscolar: f.cicloEscolar ?? null,
          padreId: null,
        });
        await this.alumnoRepository.save(alumno);

        credenciales.push({
          nombre: f.nombre,
          apellido: f.apellidoPaterno || f.nombre,
          email,
          password,
          tipo: 'alumno',
        });
        creados++;

        this.auditService.log('registro_alumno', {
          usuarioId: auditContext?.usuarioId ?? null,
          ip: auditContext?.ip ?? null,
          detalles: `carga_masiva | ${email} | escuelaId: ${escuelaId}`,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errores.push({ fila: filaNum, email, mensaje: msg });
      }
    }

    return { creados, errores, credenciales };
  }

  /**
   * Carga masiva de maestros en una escuela.
   */
  async cargarMaestros(
    escuelaId: number,
    filas: FilaMaestro[],
    auditContext?: AuditContext,
  ): Promise<ResultadoCarga> {
    const escuela = await this.escuelaRepository.findOne({ where: { id: escuelaId } });
    if (!escuela) throw new Error('Escuela no encontrada');

    const credenciales: ResultadoCarga['credenciales'] = [];
    const errores: ResultadoCarga['errores'] = [];
    let creados = 0;

    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      const filaNum = i + 2;

      const email = f.email?.trim().toLowerCase();
      if (!email) {
        errores.push({ fila: filaNum, mensaje: 'Email vacío' });
        continue;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errores.push({ fila: filaNum, email, mensaje: 'Email inválido' });
        continue;
      }

      let password = f.password?.trim();
      if (!password || password.length < 6) {
        password = generarPassword(8);
      }

      const existente = await this.personaRepository.findOne({ where: { correo: email } });
      if (existente) {
        errores.push({ fila: filaNum, email, mensaje: 'Email ya registrado' });
        continue;
      }

      try {
        const hashed = await bcrypt.hash(password, 10);
        const persona = this.personaRepository.create({
          nombre: f.nombre,
          apellidoPaterno: f.apellidoPaterno || f.nombre,
          apellidoMaterno: f.apellidoMaterno?.trim() || null,
          correo: email,
          password: hashed,
          tipoPersona: 'maestro',
          activo: true,
        });
        const personaGuardada = await this.personaRepository.save(persona);

        const maestro = this.maestroRepository.create({
          personaId: personaGuardada.id,
          escuelaId,
          especialidad: f.especialidad ?? null,
        });
        await this.maestroRepository.save(maestro);

        credenciales.push({
          nombre: f.nombre,
          apellido: f.apellidoPaterno || f.nombre,
          email,
          password,
          tipo: 'maestro',
        });
        creados++;

        this.auditService.log('registro_maestro', {
          usuarioId: auditContext?.usuarioId ?? null,
          ip: auditContext?.ip ?? null,
          detalles: `carga_masiva | ${email} | escuelaId: ${escuelaId}`,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errores.push({ fila: filaNum, email, mensaje: msg });
      }
    }

    return { creados, errores, credenciales };
  }

  /**
   * Genera un buffer Excel con las credenciales (diseño profesional).
   */
  async generarExcelCredenciales(credenciales: ResultadoCarga['credenciales']): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'API Lector';
    const ws = wb.addWorksheet('Credenciales', { views: [{ state: 'frozen', ySplit: 1 }] });

    const colWidths = [22, 22, 32, 18, 12];
    ['A', 'B', 'C', 'D', 'E'].forEach((col, i) => { ws.getColumn(col).width = colWidths[i]; });

    // Título
    ws.mergeCells('A1:E1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'Credenciales generadas';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FF1E3A5F' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
    ws.getRow(1).height = 28;

    // Encabezados
    const headers = ['Nombre', 'Apellido', 'Correo', 'Contraseña', 'Tipo'];
    const headerRow = ws.getRow(2);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    headerRow.height = 22;

    // Datos
    credenciales.forEach((c, idx) => {
      const row = ws.getRow(3 + idx);
      [c.nombre, c.apellido, c.email, c.password, c.tipo].forEach((val, i) => {
        const cell = row.getCell(i + 1);
        cell.value = val;
        cell.font = { size: 10, color: { argb: 'FF374151' } };
        cell.fill = idx % 2 === 1 ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } } : undefined;
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
      });
      row.height = 20;
    });

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  /**
   * Genera la plantilla Excel para carga masiva (diseño profesional).
   */
  async generarPlantillaCargaMasiva(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'API Lector';
    const ws = wb.addWorksheet('Alumnos', { views: [{ state: 'frozen', ySplit: 2 }] });

    const colWidths = [18, 18, 18, 28, 14, 8, 10, 14];
    'ABCDEFGH'.split('').forEach((col, i) => { ws.getColumn(col).width = colWidths[i]; });

    // Título e instrucciones
    ws.mergeCells('A1:H1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'Plantilla de carga masiva — Alumnos';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FF1E3A5F' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    ws.getRow(1).height = 32;

    ws.mergeCells('A2:H2');
    const infoCell = ws.getCell('A2');
    infoCell.value = 'Complete las filas. Obligatorios: nombre, apellidoPaterno, apellidoMaterno, email. Password opcional (mín 6 caracteres). Grado, grupo y cicloEscolar opcionales.';
    infoCell.font = { size: 9, italic: true, color: { argb: 'FF6B7280' } };
    infoCell.alignment = { wrapText: true, vertical: 'middle' };
    infoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    ws.getRow(2).height = 36;

    // Encabezados
    const headers = ['nombre', 'apellidoPaterno', 'apellidoMaterno', 'email', 'password', 'grado', 'grupo', 'cicloEscolar'];
    const headerRow = ws.getRow(3);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'medium' }, left: { style: 'thin' }, bottom: { style: 'medium' }, right: { style: 'thin' } };
    });
    headerRow.height = 24;

    // Filas de ejemplo
    const ejemplos = [
      ['Juan', 'Pérez', 'García', 'juan@ejemplo.com', '(opcional)', '1', 'A', '2024-2025'],
      ['María', 'López', 'Sánchez', 'maria@ejemplo.com', 'mipass123', '2', 'B', ''],
    ];
    ejemplos.forEach((vals, idx) => {
      const row = ws.getRow(4 + idx);
      vals.forEach((val, i) => {
        const cell = row.getCell(i + 1);
        cell.value = val;
        cell.font = { size: 10, color: { argb: 'FF4B5563' } };
        cell.fill = idx % 2 === 1 ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } } : undefined;
        cell.alignment = { vertical: 'middle' };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
      });
      row.height = 20;
    });

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
