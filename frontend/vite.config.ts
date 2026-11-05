import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/**
 * En desarrollo, Vite hace de gateway igual que server.js en producción:
 *   /api/*       → BFF            (http://localhost:4000)
 *   /admin-api/* → vacantes-service /admin/* (http://localhost:4100)
 * Las llaves del gateway NO llevan prefijo VITE_, así que nunca llegan al bundle del navegador.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const bff = env.BFF_URL ?? 'http://localhost:4000'
  const admin = env.ADMIN_SERVICE_URL ?? 'http://localhost:4100'
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: bff,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
          headers: env.BFF_GATEWAY_KEY ? { 'x-gateway-key': env.BFF_GATEWAY_KEY } : {},
        },
        '/admin-api': {
          target: admin,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/admin-api/, '/admin'),
          headers: env.ADMIN_GATEWAY_KEY ? { 'x-gateway-key': env.ADMIN_GATEWAY_KEY } : {},
        },
      },
    },
    build: { sourcemap: false, chunkSizeWarningLimit: 800 },
  }
})
