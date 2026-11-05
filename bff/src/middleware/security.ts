import type { NextFunction, Request, Response } from 'express'
import { config } from '../config.js'
import { safeEqual } from '../lib/crypto.js'
import { AppError } from '../lib/errors.js'

/**
 * Solo el gateway del frontend (que inyecta x-gateway-key del lado servidor) puede consumir el BFF.
 * Si alguien descubre la URL pública del BFF en Render, recibe 404.
 */
export function requireGateway(req: Request, _res: Response, next: NextFunction) {
  if (!config.GATEWAY_KEY) return next()
  const key = req.get('x-gateway-key') ?? ''
  if (!safeEqual(key, config.GATEWAY_KEY)) return next(new AppError(404, 'NOT_FOUND', 'Recurso no encontrado.'))
  next()
}

/**
 * Anti-CSRF para métodos que modifican estado:
 *  1) Header personalizado obligatorio (un formulario de otro sitio no puede enviarlo sin preflight CORS,
 *     y este servidor no responde CORS).
 *  2) Si el navegador manda Origin, debe ser uno permitido.
 */
export function csrf(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  if (req.get('x-linces-csrf') !== '1') return next(new AppError(403, 'CSRF', 'Solicitud rechazada (CSRF).'))
  const origin = req.get('origin')
  if (origin && !config.ALLOWED_ORIGINS.includes(origin)) {
    return next(new AppError(403, 'CSRF', 'Origen no permitido.'))
  }
  next()
}

/** Datos académicos = privados: que ningún proxy ni el navegador los guarde en caché. */
export function noStore(_req: Request, res: Response, next: NextFunction) {
  res.set('Cache-Control', 'no-store')
  res.set('Pragma', 'no-cache')
  next()
}
