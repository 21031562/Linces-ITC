import pino from 'pino'
import { config } from '../config.js'

export const logger = pino({
  level: config.LOG_LEVEL,
  // Nunca registrar credenciales, cookies ni tokens
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers["x-gateway-key"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.password_hash',
    ],
    censor: '[oculto]',
  },
})
