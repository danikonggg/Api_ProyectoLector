import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': { target: 'http://localhost:3000', changeOrigin: true },
      '/personas': { target: 'http://localhost:3000', changeOrigin: true },
      '/escuelas': { target: 'http://localhost:3000', changeOrigin: true },
      '/libros': { target: 'http://localhost:3000', changeOrigin: true },
      '/maestros': { target: 'http://localhost:3000', changeOrigin: true },
      '/director': { target: 'http://localhost:3000', changeOrigin: true },
      '/admin': { target: 'http://localhost:3000', changeOrigin: true },
      '/audit': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
