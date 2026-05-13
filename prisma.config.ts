import { defineConfig } from 'prisma/config';

// En producción (Render) las env vars vienen del entorno directamente.
// En local, NestJS las carga desde .env antes de que esto se ejecute.
export default defineConfig({
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
});
