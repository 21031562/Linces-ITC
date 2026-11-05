import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import { config } from './config.js'
import { logger } from './lib/logger.js'
import { errorHandler } from './middleware/errors.js'
import { csrf, noStore, requireGateway, requireInternalKey } from './middleware/security.js'
import { adminRouter } from './routes/admin.js'
import { internalRouter } from './routes/internal.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.TRUST_PROXY)
  app.use(helmet())
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }))

  app.get('/health', (_req, res) => {
    res.json({ ok: true, servicio: 'linces-vacantes' })
  })

  app.use(express.json({ limit: '50kb' }))
  app.use(noStore)

  // BFF → servicio (servidor a servidor)
  app.use('/internal', requireInternalKey, internalRouter)
  // Panel de administración (navegador → gateway frontend → aquí)
  app.use('/admin', requireGateway, cookieParser(), csrf, adminRouter)

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso no encontrado.' } })
  })
  app.use(errorHandler)
  return app
}
