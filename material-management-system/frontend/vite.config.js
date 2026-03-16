import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration: proxy API requests to backend during development
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});