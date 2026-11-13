import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { devBackend } from './dev/shim.ts'

export default defineConfig({
  plugins: [react(), devBackend()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**', '**/.dev-library/**'] } },
  build: { target: 'safari16', chunkSizeWarningLimit: 4000 },
})
