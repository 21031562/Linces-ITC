import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { code: 'VALIDATION', message: err.issues[0]?.message ?? 'Datos inválidos.' } })
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } })
  }
  const pgCode = (err as { pgCode?: string })?.pgCode
  if (pgCode === '23505') return res.status(409).json({ error: { code: 'CONFLICT', message: 'El registro ya existe.' } })
  if (pgCode === '23503') {
    return res
      .status(409)
      .json({ error: { code: 'CONFLICT', message: 'No se puede eliminar: hay registros que dependen de este.' } })
  }
  if (pgCode === '22P02') return res.status(400).json({ error: { code: 'VALIDATION', message: 'Identificador inválido.' } })
  logger.error({ err }, 'error no controlado')
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Ocurrió un error inesperado.' } })
}
