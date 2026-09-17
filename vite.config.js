import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Solo medimos el código de la app; config y salidas de build no aportan señal.
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/setupTests.js', 'src/**/*.test.{js,jsx}'],
    },
  }
})
