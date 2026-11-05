import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'
import { destroySession } from '../services/sessionStore.js'
import { audit } from '../services/audit.js'
import { clearSessionCookie } from './session.js'

export async function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'VALIDATION', message: err.issues[0]?.message ?? 'Datos inválidos.' },
    })
  }
  if (err instanceof AppError) {
    // Si el SII rechazó el token, la sesión local ya no sirve: se elimina
    if (err.code === 'TOKEN_EXPIRED' && req.sesion) {
      await destroySession(req.sesion.idHash).catch(() => {})
      void audit('token_rechazado', req.sesion.numeroControl)
      clearSessionCookie(res)
    }
    return res.status(err.status).json({ error: { code: err.code, message: err.message } })
  }
  logger.error({ err }, 'error no controlado')
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Ocurrió un error inesperado.' } })
}
