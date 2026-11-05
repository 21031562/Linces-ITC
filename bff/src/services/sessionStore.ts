import { config } from '../config.js'
import { decrypt, encrypt, newSessionId, sha256 } from '../lib/crypto.js'
import { Errors } from '../lib/errors.js'
import { jwtExpiration } from '../lib/jwt.js'
import { db } from '../lib/supabase.js'
import { audit } from './audit.js'

export interface Session {
  idHash: string
  numeroControl: string
  token: string // JWT del SII ya descifrado (solo en memoria del servidor)
  expiraEn: Date
}

const IDLE_MS = config.SESSION_IDLE_MINUTES * 60_000
const MAX_MS = config.SESSION_MAX_HOURS * 3_600_000
const TOUCH_EVERY_MS = 60_000 // no escribir en BD en cada request

export async function createSession(opts: {
  token: string
  numeroControl: string
  userAgent?: string
}): Promise<{ sid: string; expiraEn: Date }> {
  const sid = newSessionId()
  const maxExp = new Date(Date.now() + MAX_MS)
  const jwtExp = jwtExpiration(opts.token)
  // La sesión nunca dura más que el propio token del SII
  const expiraEn = jwtExp && jwtExp < maxExp ? jwtExp : maxExp

  // Una sola sesión activa por alumno: al entrar desde otro navegador o dispositivo, las anteriores se cierran
  await db.from('sesiones').delete().eq('numero_control', opts.numeroControl)

  const { error } = await db.from('sesiones').insert({
    id_hash: sha256(sid),
    numero_control: opts.numeroControl,
    token_cifrado: encrypt(opts.token),
    expira_en: expiraEn.toISOString(),
    user_agent: opts.userAgent?.slice(0, 200) ?? null,
  })
  if (error) throw new Error(`No se pudo crear la sesión: ${error.message}`)
  return { sid, expiraEn }
}

/** Valida existencia, expiración absoluta (exp del JWT) e inactividad. */
export async function getSession(sid: string): Promise<Session> {
  const idHash = sha256(sid)
  const { data, error } = await db
    .from('sesiones')
    .select('numero_control, token_cifrado, expira_en, ultimo_uso')
    .eq('id_hash', idHash)
    .maybeSingle()

  if (error) throw new Error(`Error leyendo sesión: ${error.message}`)
  // Había cookie pero la sesión ya no existe: se cerró en otra pestaña, otro dispositivo o expiró
  if (!data) throw Errors.closed()

  const now = Date.now()
  const expiraEn = new Date(data.expira_en)
  if (expiraEn.getTime() <= now) {
    await destroySession(idHash)
    void audit('sesion_expirada', data.numero_control)
    throw Errors.expired()
  }
  const ultimoUso = new Date(data.ultimo_uso).getTime()
  if (now - ultimoUso > IDLE_MS) {
    await destroySession(idHash)
    void audit('sesion_inactiva', data.numero_control)
    throw Errors.idle()
  }
  if (now - ultimoUso > TOUCH_EVERY_MS) {
    void db.from('sesiones').update({ ultimo_uso: new Date(now).toISOString() }).eq('id_hash', idHash).then()
  }

  let token: string
  try {
    token = decrypt(data.token_cifrado)
  } catch {
    // Llave rotada o dato alterado: la sesión deja de ser válida
    await destroySession(idHash)
    throw Errors.expired()
  }
  return { idHash, numeroControl: data.numero_control, token, expiraEn }
}

export async function destroySession(idHash: string): Promise<void> {
  await db.from('sesiones').delete().eq('id_hash', idHash)
}

export const hashSid = sha256
