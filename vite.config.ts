import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isElectron = process.env.ELECTRON === '1';

export default defineConfig({
  // Use relative base for Electron (file:// protocol)
  // Use absolute base for normal web deployment
  base: isElectron ? './' : '/',
  plugins: [react()],
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
  worker: {
    format: 'es',
  },
});
