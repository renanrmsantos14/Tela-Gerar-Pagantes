import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import packageJson from './package.json'

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __APP_DATE__: JSON.stringify(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date()))
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/gerar-pagantes.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (asset) => asset.name?.endsWith('.css') ? 'assets/gerar-pagantes.css' : 'assets/[name][extname]'
      }
    }
  }
})
