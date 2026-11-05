import type { NextFunction, Request, Response } from 'express'
import { ADMIN_COOKIE, config, cookieSecure } from '../config.js'
import { safeEqual, sha256 } from '../lib/crypto.js'
import { AppError } from '../lib/errors.js'
import { check, db } from '../lib/supabase.js'

export interface AdminCtx {
  id: string
  email: string
  nombre: string
  rol: 'admin' | 'revisor'
  sesionHash: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminCtx
    }
  }
}

/** /internal/* — solo el BFF (llave servidor-a-servidor) */
export function requireInternalKey(req: Request, _res: Response, next: NextFunction) {
  if (!safeEqual(req.get('x-internal-key') ?? '', config.INTERNAL_KEY)) {
    return next(new AppError(404, 'NOT_FOUND', 'Recurso no encontrado.'))
  }
  next()
}

/** /admin/* — solo a través del gateway del frontend */
export function requireGateway(req: Request, _res: Response, next: NextFunction) {
  if (!config.GATEWAY_KEY) return next()
  if (!safeEqual(req.get('x-gateway-key') ?? '', config.GATEWAY_KEY)) {
    return next(new AppError(404, 'NOT_FOUND', 'Recurso no encontrado.'))
  }
  next()
}

export function csrf(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  if (req.get('x-linces-csrf') !== '1') return next(new AppError(403, 'CSRF', 'Solicitud rechazada (CSRF).'))
  const origin = req.get('origin')
  if (origin && !config.ALLOWED_ORIGINS.includes(origin)) return next(new AppError(403, 'CSRF', 'Origen no permitido.'))
  next()
}

export const adminCookieOptions = (expires?: Date) => ({
  httpOnly: true,
  secure: cookieSecure,
  sameSite: 'strict' as const,
  path: '/',
  ...(expires ? { expires } : {}),
})

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const sid: string | undefined = req.cookies?.[ADMIN_COOKIE]
  if (!sid) return next(new AppError(401, 'NO_SESSION', 'Inicia sesión como administrador.'))
  const sesionHash = sha256(sid)
  const row = check(
    await db
      .from('admin_sesiones')
      .select('expira_en, admins!inner(id, email, nombre, rol, activo)')
      .eq('id_hash', sesionHash)
      .maybeSingle(),
  ) as unknown as {
    expira_en: string
    admins: { id: string; email: string; nombre: string; rol: 'admin' | 'revisor'; activo: boolean }
  } | null

  if (!row || new Date(row.expira_en) <= new Date() || !row.admins.activo) {
    if (row) await db.from('admin_sesiones').delete().eq('id_hash', sesionHash)
    res.clearCookie(ADMIN_COOKIE, adminCookieOptions())
    return next(new AppError(401, 'SESSION_EXPIRED', 'Tu sesión de administrador expiró.'))
  }
  req.admin = { ...row.admins, sesionHash }
  next()
}

export const requireRol =
  (...roles: AdminCtx['rol'][]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.admin || !roles.includes(req.admin.rol)) {
      return next(new AppError(403, 'FORBIDDEN', 'Tu rol no permite esta acción.'))
    }
    next()
  }

export function noStore(_req: Request, res: Response, next: NextFunction) {
  res.set('Cache-Control', 'no-store')
  next()
}
