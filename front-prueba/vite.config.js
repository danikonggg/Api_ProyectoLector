import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:3000',
      '/personas': 'http://localhost:3000',
      '/escuelas': 'http://localhost:3000',
      '/libros': 'http://localhost:3000',
      '/maestros': 'http://localhost:3000',
    },
  },
});
