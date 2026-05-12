import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMateriaDto } from './dto/create-materia.dto';
import { UpdateMateriaDto } from './dto/update-materia.dto';

@Injectable()
export class MateriasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const materias = await this.prisma.materia.findMany({ orderBy: { nombre: 'asc' } });
    return {
      message: 'Materias obtenidas correctamente',
      total: materias.length,
      data: materias,
    };
  }

  async findOne(id: number) {
    const materia = await this.prisma.materia.findUnique({ where: { id: BigInt(id) } });
    if (!materia) throw new NotFoundException(`No se encontró la materia con ID ${id}`);
    return { message: 'Materia encontrada', data: materia };
  }

  async create(dto: CreateMateriaDto) {
    const existente = await this.prisma.materia.findFirst({
      where: { nombre: dto.nombre.trim() },
    });
    if (existente) {
      throw new ConflictException(`Ya existe una materia con el nombre "${dto.nombre}"`);
    }

    const materia = await this.prisma.materia.create({
      data: {
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion?.trim() || null,
        nivel: dto.nivel?.trim() || null,
      },
    });

    return { message: 'Materia creada correctamente', data: materia };
  }

  async update(id: number, dto: UpdateMateriaDto) {
    const materia = await this.prisma.materia.findUnique({ where: { id: BigInt(id) } });
    if (!materia) throw new NotFoundException(`No se encontró la materia con ID ${id}`);

    if (dto.nombre != null) {
      const existente = await this.prisma.materia.findFirst({
        where: { nombre: dto.nombre.trim() },
      });
      if (existente && Number(existente.id) !== id) {
        throw new ConflictException(`Ya existe una materia con el nombre "${dto.nombre}"`);
      }
    }

    const guardada = await this.prisma.materia.update({
      where: { id: BigInt(id) },
      data: {
        ...(dto.nombre != null && { nombre: dto.nombre.trim() }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion?.trim() || null }),
        ...(dto.nivel !== undefined && { nivel: dto.nivel?.trim() || null }),
      },
    });

    return { message: 'Materia actualizada correctamente', data: guardada };
  }

  async remove(id: number) {
    const materia = await this.prisma.materia.findUnique({ where: { id: BigInt(id) } });
    if (!materia) throw new NotFoundException(`No se encontró la materia con ID ${id}`);

    await this.prisma.materia.delete({ where: { id: BigInt(id) } });
    return { message: 'Materia eliminada correctamente' };
  }
}
