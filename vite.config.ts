import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-markdown': ['react-markdown', 'marked'],
            'vendor-genai': ['@google/genai'],
            'vendor-icons': ['lucide-react'],
            'vendor-pdf': ['html2pdf.js', 'jspdf', 'html2canvas'],
            'vendor-docx': ['html-to-docx', 'jszip'],
          }
        }
      },
      chunkSizeWarningLimit: 1000,
    }
  };
});
