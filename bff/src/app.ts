import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import { config } from './config.js'
import { logger } from './lib/logger.js'
import { errorHandler } from './middleware/errors.js'
import { csrf, noStore, requireGateway } from './middleware/security.js'
import { requireSession } from './middleware/session.js'
import { academicoRouter } from './routes/academico.js'
import { authRouter } from './routes/auth.js'
import { vacantesRouter } from './routes/vacantes.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.TRUST_PROXY)

  // Sin CORS a propósito: el navegador solo habla con el gateway del frontend (mismo origen).
  app.use(helmet())
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }))

  app.get('/health', (_req, res) => {
    res.json({ ok: true, servicio: 'linces-bff' })
  })

  app.use(requireGateway)
  app.use(express.json({ limit: '20kb' }))
  app.use(cookieParser())
  app.use(noStore)
  app.use(csrf)

  app.use('/auth', authRouter)
  // Todo lo demás requiere sesión válida (una sola lectura de sesión por petición)
  app.use(requireSession, academicoRouter, vacantesRouter)

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso no encontrado.' } })
  })
  app.use(errorHandler)
  return app
}
