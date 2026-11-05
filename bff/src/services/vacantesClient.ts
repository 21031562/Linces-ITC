import { config } from '../config.js'
import { AppError, Errors } from '../lib/errors.js'

/**
 * Cliente servidor-a-servidor hacia vacantes-service (/internal/*).
 * Autenticado con una llave interna que nunca sale del backend.
 */
export async function vacantesApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15_000) // Render free puede tardar en "despertar"
  let res: Response
  try {
    res = await fetch(`${config.VACANTES_URL}/internal${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': config.VACANTES_INTERNAL_KEY,
        ...(init.headers ?? {}),
      },
    })
  } catch {
    throw Errors.vacantesDown()
  } finally {
    clearTimeout(timer)
  }

  const body = (await res.json().catch(() => null)) as any
  if (!res.ok) {
    if (res.status >= 500 || !body?.error) throw Errors.vacantesDown()
    throw new AppError(res.status, body.error.code, body.error.message)
  }
  return body.data as T
}
