import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const [escuelasActivas, totalEstudiantes, totalProfesores, librosDisponibles] =
      await Promise.all([
        this.prisma.escuela.count(),
        this.prisma.alumno.count(),
        this.prisma.maestro.count(),
        this.prisma.libro.count({ where: { estado: 'listo' } }),
      ]);

    return {
      message: 'Dashboard obtenido correctamente',
      data: {
        escuelasActivas,
        totalEstudiantes,
        totalProfesores,
        librosDisponibles,
      },
    };
  }
}
