import { config } from '../config.js'
import { AppError, Errors } from './errors.js'
import type {
  SiiCalificacionesPeriodo,
  SiiEstudiante,
  SiiHorarioPeriodo,
  SiiKardex,
} from '../types/sii.js'

/**
 * Cliente del API SII ITC. Es el ÚNICO lugar del sistema que habla con el SII.
 * Particularidad: el SII responde HTTP 200 casi siempre; el estado real viene en `body.status`.
 */
async function request(path: string, init: RequestInit): Promise<{ http: number; body: any }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), config.SII_TIMEOUT_MS)
  try {
    const res = await fetch(`${config.SII_BASE_URL}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { Accept: 'application/json', ...(init.headers ?? {}) },
    })
    if (res.status >= 500) throw Errors.siiDown()
    let body: any = null
    try {
      body = await res.json()
    } catch {
      if (res.status === 401) return { http: 401, body: null }
      throw Errors.siiError()
    }
    return { http: res.status, body }
  } catch (err) {
    if (err instanceof AppError) throw err
    // timeout, DNS, conexión rechazada…
    throw Errors.siiDown()
  } finally {
    clearTimeout(timer)
  }
}

export async function siiLogin(email: string, password: string): Promise<string> {
  const { http, body } = await request('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const status = Number(body?.status ?? http)
  const token: unknown = body?.message?.login?.token
  if (status === 401 || status === 422 || http === 401 || http === 422 || typeof token !== 'string') {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.')
  }
  return token
}

async function siiGet<T>(path: string, token: string): Promise<T> {
  const { http, body } = await request(path, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (http === 401 || http === 403 || Number(body?.status) === 401) throw Errors.tokenRejected()
  if (http >= 400 || body?.data === undefined) throw Errors.siiError()
  return body.data as T
}

export const sii = {
  estudiante: (t: string) => siiGet<SiiEstudiante>('/movil/estudiante', t),
  calificaciones: (t: string) => siiGet<SiiCalificacionesPeriodo[]>('/movil/estudiante/calificaciones', t),
  kardex: (t: string) => siiGet<SiiKardex>('/movil/estudiante/kardex', t),
  horarios: (t: string) => siiGet<SiiHorarioPeriodo[]>('/movil/estudiante/horarios', t),
}
