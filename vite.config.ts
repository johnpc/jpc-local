import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      './runtimeConfig': './runtimeConfig.browser',
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    include: ['@aws-amplify/ui-react-geo', 'buffer'],
  },
})
