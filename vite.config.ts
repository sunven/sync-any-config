import path from 'node:path'
import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

const host = process.env.TAURI_DEV_HOST
const requiredBuildEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const

export default defineConfig(async ({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  if (command === 'build') {
    const missingEnv = requiredBuildEnv.filter(name => !(process.env[name] ?? env[name]))
    if (missingEnv.length > 0) {
      throw new Error(
        `Missing required build environment variables: ${missingEnv.join(', ')}. `
        + 'Set them in .env.local for local builds or GitHub Actions secrets for release builds.',
      )
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: 'ws',
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        ignored: ['**/src-tauri/**'],
      },
    },
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: './src/test/setup.ts',
      include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    },
  }
})
