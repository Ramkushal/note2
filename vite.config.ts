import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isElectron = process.env.ELECTRON === '1';

export default defineConfig({
  // Use relative base for Electron (file:// protocol)
  // Use absolute base for normal web deployment
  base: isElectron ? './' : '/',
  build: {
    outDir: 'app-dist',
    emptyOutDir: true
  },
  plugins: [
    react(),
    {
      name: 'remove-crossorigin',
      transformIndexHtml(html) {
        return html.replace(/ crossorigin/g, '');
      }
    }
  ],
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
  worker: {
    format: 'es',
  },
});
