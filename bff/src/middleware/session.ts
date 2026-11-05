import type { NextFunction, Request, Response } from 'express'
import { SESSION_COOKIE, cookieSecure } from '../config.js'
import { AppError, Errors } from '../lib/errors.js'
import { getSession, type Session } from '../services/sessionStore.js'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sesion?: Session
    }
  }
}

export const cookieOptions = (expires?: Date) => ({
  httpOnly: true, // JavaScript del navegador no puede leerla (mitiga XSS)
  secure: cookieSecure, // solo viaja por HTTPS
  sameSite: 'lax' as const, // no se envía en peticiones cross-site que modifican estado
  path: '/',
  ...(expires ? { expires } : {}),
})

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions())
}

export async function requireSession(req: Request, res: Response, next: NextFunction) {
  const sid: string | undefined = req.cookies?.[SESSION_COOKIE]
  if (!sid) return next(Errors.noSession())
  try {
    req.sesion = await getSession(sid)
    next()
  } catch (err) {
    if (err instanceof AppError && err.status === 401) clearSessionCookie(res)
    next(err)
  }
}
