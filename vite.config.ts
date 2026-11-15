import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'
import { devBackend } from './dev/shim.ts'

export default defineConfig({
  plugins: [react(), devBackend()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**', '**/.dev-library/**'] } },
  build: { target: 'safari16', chunkSizeWarningLimit: 4000 },
  // Las copias de trabajo de otras sesiones (.claude/worktrees) no son de esta rama.
  test: { exclude: [...configDefaults.exclude, '.claude/**', '.dev-projects/**'] },
})
