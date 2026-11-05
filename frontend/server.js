/**
 * Gateway de producción del frontend (Render Web Service).
 *  - Sirve el build estático de Vite (dist/).
 *  - Reenvía /api/* al BFF y /admin-api/* al servicio de vacantes DEL LADO DEL SERVIDOR.
 *    El navegador solo ve su propio dominio: no conoce las URLs de los backends ni del SII,
 *    y las cookies HttpOnly quedan como first-party (onrender.com está en la Public Suffix List).
 *  - Inyecta las llaves del gateway, que jamás llegan al navegador.
 */
import compression from 'compression'
import express from 'express'
import helmet from 'helmet'
import { createProxyMiddleware } from 'http-proxy-middleware'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 3000)
const BFF_URL = process.env.BFF_URL
const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL
if (!BFF_URL || !ADMIN_SERVICE_URL) {
  console.error('❌ Faltan BFF_URL y/o ADMIN_SERVICE_URL')
  process.exit(1)
}

const isProd = process.env.NODE_ENV === 'production'
const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)

app.get('/health', (_req, res) => {
  res.json({ ok: true, servicio: 'linces-frontend' })
})

const proxy = (target, from, to, key) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    xfwd: true,
    proxyTimeout: 60_000, // Render free puede tardar en despertar a los backends
    pathRewrite: (p) => p.replace(new RegExp(`^${from}`), to),
    on: {
      proxyReq: (proxyReq) => {
        if (key) proxyReq.setHeader('x-gateway-key', key)
      },
      error: (_err, _req, res) => {
        if (!res.headersSent && typeof res.writeHead === 'function') {
          res.writeHead(502, { 'Content-Type': 'application/json' })
        }
        res.end(JSON.stringify({ error: { code: 'BACKEND_DOWN', message: 'El servidor está iniciando o no responde. Intenta de nuevo en unos segundos.' } }))
      },
    },
  })

// Se filtra por ruta completa (no app.use('/api')) para que el proxy reciba la URL original
const apiProxy = proxy(BFF_URL, '/api', '', process.env.BFF_GATEWAY_KEY)
const adminProxy = proxy(ADMIN_SERVICE_URL, '/admin-api', '/admin', process.env.ADMIN_GATEWAY_KEY)
app.use((req, res, next) => (req.path.startsWith('/api/') ? apiProxy(req, res, next) : next()))
app.use((req, res, next) => (req.path.startsWith('/admin-api/') ? adminProxy(req, res, next) : next()))

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"], // recharts usa estilos en línea
        'img-src': ["'self'", 'data:', 'https://sii.celaya.tecnm.mx'],
        'font-src': ["'self'"],
        'connect-src': ["'self'"], // el navegador SOLO puede llamar a este mismo dominio
        'frame-ancestors': ["'none'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'upgrade-insecure-requests': isProd ? [] : null,
      },
    },
    strictTransportSecurity: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }),
)
app.use(compression())

const dist = path.join(__dirname, 'dist')
app.use(
  '/assets',
  express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y', index: false }),
)
app.use(express.static(dist, { index: false, maxAge: '1h' }))
// SPA: cualquier otra ruta devuelve index.html (React Router decide)
app.get('/{*splat}', (_req, res) => {
  res.set('Cache-Control', 'no-cache')
  res.sendFile(path.join(dist, 'index.html'))
})

app.listen(PORT, () => console.log(`Linces frontend en :${PORT}`))
