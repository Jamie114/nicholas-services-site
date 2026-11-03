import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        calculators: fileURLToPath(new URL('./calculators/index.html', import.meta.url)),
        services: fileURLToPath(new URL('./how-we-can-help/index.html', import.meta.url)),
        approach: fileURLToPath(new URL('./our-approach/index.html', import.meta.url)),
      },
    },
  },
})
