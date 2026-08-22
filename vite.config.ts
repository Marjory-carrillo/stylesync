import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          
          // React core (se necesita siempre, primero en cargar)
          if (id.includes('react-dom') || id.includes('react-router') || 
              id.includes('/react/')) {
            return 'vendor-react';
          }
          // Supabase (auth + API)
          if (id.includes('@supabase')) {
            return 'vendor-supabase';
          }
          // Gráficas (solo Dashboard)
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'vendor-charts';
          }
          // PDF + OCR (solo Quoter/Deposits)
          if (id.includes('jspdf') || id.includes('html2canvas') || 
              id.includes('tesseract')) {
            return 'vendor-pdf-ocr';
          }
          // Internacionalización
          if (id.includes('i18next')) {
            return 'vendor-i18n';
          }
          // Todo lo demás
          return 'vendor-misc';
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
  }
})
