/**
 * Cliente HTTP del frontend.
 * - Solo habla con rutas relativas (/api y /admin-api) del MISMO origen.
 *   El gateway (server.js en producción, Vite en desarrollo) las reenvía a los backends.
 * - Nunca maneja tokens: la sesión viaja en una cookie HttpOnly que JavaScript no puede leer.
 */
export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
  get isAuth() {
    return this.status === 401
  }
}

export const AUTH_MESSAGES: Record<string, string> = {
  NO_SESSION: 'Inicia sesión para continuar.',
  SESSION_EXPIRED: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  SESSION_IDLE: 'Cerramos tu sesión por inactividad.',
  TOKEN_EXPIRED: 'El SII ya no reconoce tu sesión (token inválido o expirado). Inicia sesión de nuevo.',
  LOGOUT: 'Cerraste sesión.',
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

async function request<T>(base: string, path: string, method: Method = 'GET', body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${base}${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        // Header anti-CSRF: un sitio externo no puede enviarlo sin permiso CORS
        ...(method !== 'GET' ? { 'x-linces-csrf': '1' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'No pudimos conectar con el servidor. Revisa tu conexión a internet.')
  }

  const json = (await res.json().catch(() => null)) as { data?: T; error?: { code: string; message: string } } | null
  if (!res.ok) {
    if (json?.error) throw new ApiError(res.status, json.error.code, json.error.message)
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new ApiError(res.status, 'BACKEND_DOWN', 'El servidor está iniciando o no responde. Intenta de nuevo en unos segundos.')
    }
    throw new ApiError(res.status, 'HTTP', `El servidor respondió con un error (${res.status}).`)
  }
  return json?.data as T
}

const make = (base: string) => ({
  get: <T>(p: string) => request<T>(base, p),
  post: <T>(p: string, b: unknown = {}) => request<T>(base, p, 'POST', b),
  patch: <T>(p: string, b: unknown) => request<T>(base, p, 'PATCH', b),
  del: <T>(p: string) => request<T>(base, p, 'DELETE'),
})

export const api = make('/api')
export const adminApi = make('/admin-api')
