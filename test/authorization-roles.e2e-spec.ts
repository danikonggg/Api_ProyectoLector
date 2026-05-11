import { Controller, Get, INestApplication, Module, Req, UseGuards } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { DirectorGuard } from '../src/auth/guards/director.guard';
import { MaestroGuard } from '../src/auth/guards/maestro.guard';
import { AlumnoGuard } from '../src/auth/guards/alumno.guard';
import { AdminOrDirectorGuard } from '../src/auth/guards/admin-or-director.guard';
import { AdminOrDirectorOrAlumnoGuard } from '../src/auth/guards/admin-or-director-or-alumno.guard';

@Controller('authz')
class AuthzController {
  @Get('admin')
  @UseGuards(AdminGuard)
  admin() {
    return { ok: true };
  }

  @Get('director')
  @UseGuards(DirectorGuard)
  director() {
    return { ok: true };
  }

  @Get('maestro')
  @UseGuards(MaestroGuard)
  maestro() {
    return { ok: true };
  }

  @Get('alumno')
  @UseGuards(AlumnoGuard)
  alumno() {
    return { ok: true };
  }

  @Get('admin-o-director')
  @UseGuards(AdminOrDirectorGuard)
  adminOrDirector() {
    return { ok: true };
  }

  @Get('admin-o-director-o-alumno')
  @UseGuards(AdminOrDirectorOrAlumnoGuard)
  adminOrDirectorOrAlumno() {
    return { ok: true };
  }

  @Get('echo')
  echo(@Req() req: { user?: unknown }) {
    return { user: req.user ?? null };
  }
}

@Module({
  controllers: [AuthzController],
  providers: [
    AdminGuard,
    DirectorGuard,
    MaestroGuard,
    AlumnoGuard,
    AdminOrDirectorGuard,
    AdminOrDirectorOrAlumnoGuard,
  ],
})
class AuthzTestModule {}

describe('Authorization roles (e2e)', () => {
  let app: INestApplication;

  const asHeader = (user: unknown) => ({ 'x-test-user': JSON.stringify(user) });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthzTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use((req, _res, next) => {
      const raw = req.header('x-test-user');
      if (raw) {
        try {
          req.user = JSON.parse(raw);
        } catch {
          req.user = undefined;
        }
      }
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('permite admin en ruta de admin y bloquea director', async () => {
    await request(app.getHttpServer())
      .get('/authz/admin')
      .set(asHeader({ tipoPersona: 'administrador', administrador: { id: 1 } }))
      .expect(200);

    await request(app.getHttpServer())
      .get('/authz/admin')
      .set(asHeader({ tipoPersona: 'director', director: { id: 2 } }))
      .expect(403);
  });

  it('permite director en ruta director y bloquea alumno', async () => {
    await request(app.getHttpServer())
      .get('/authz/director')
      .set(asHeader({ tipoPersona: 'director', director: { id: 2 } }))
      .expect(200);

    await request(app.getHttpServer())
      .get('/authz/director')
      .set(asHeader({ tipoPersona: 'alumno', alumno: { id: 3 } }))
      .expect(403);
  });

  it('permite maestro en ruta maestro y bloquea admin sin claim', async () => {
    await request(app.getHttpServer())
      .get('/authz/maestro')
      .set(asHeader({ tipoPersona: 'maestro', maestro: { id: 4 } }))
      .expect(200);

    await request(app.getHttpServer())
      .get('/authz/maestro')
      .set(asHeader({ tipoPersona: 'administrador', administrador: { id: 1 } }))
      .expect(403);
  });

  it('permite alumno en ruta alumno y bloquea maestro', async () => {
    await request(app.getHttpServer())
      .get('/authz/alumno')
      .set(asHeader({ tipoPersona: 'alumno', alumno: { id: 3 } }))
      .expect(200);

    await request(app.getHttpServer())
      .get('/authz/alumno')
      .set(asHeader({ tipoPersona: 'maestro', maestro: { id: 4 } }))
      .expect(403);
  });

  it('permite admin y director en guard combinado', async () => {
    await request(app.getHttpServer())
      .get('/authz/admin-o-director')
      .set(asHeader({ tipoPersona: 'administrador', administrador: { id: 1 } }))
      .expect(200);

    await request(app.getHttpServer())
      .get('/authz/admin-o-director')
      .set(asHeader({ tipoPersona: 'director', director: { id: 2 } }))
      .expect(200);

    await request(app.getHttpServer())
      .get('/authz/admin-o-director')
      .set(asHeader({ tipoPersona: 'alumno', alumno: { id: 3 } }))
      .expect(403);
  });

  it('permite admin/director/alumno y bloquea maestro en guard triple', async () => {
    await request(app.getHttpServer())
      .get('/authz/admin-o-director-o-alumno')
      .set(asHeader({ tipoPersona: 'administrador', administrador: { id: 1 } }))
      .expect(200);
    await request(app.getHttpServer())
      .get('/authz/admin-o-director-o-alumno')
      .set(asHeader({ tipoPersona: 'director', director: { id: 2 } }))
      .expect(200);
    await request(app.getHttpServer())
      .get('/authz/admin-o-director-o-alumno')
      .set(asHeader({ tipoPersona: 'alumno', alumno: { id: 3 } }))
      .expect(200);
    await request(app.getHttpServer())
      .get('/authz/admin-o-director-o-alumno')
      .set(asHeader({ tipoPersona: 'maestro', maestro: { id: 4 } }))
      .expect(403);
  });
});
