import { sha256 } from '../lib/crypto.js'
import { db } from '../lib/supabase.js'
import { logger } from '../lib/logger.js'

type Evento =
  | 'login_ok'
  | 'login_fallido'
  | 'logout'
  | 'sesion_expirada'
  | 'sesion_inactiva'
  | 'token_rechazado'
  | 'postulacion'
  | 'cancelacion'

/** Bitácora best-effort: nunca rompe la petición principal. La IP se guarda hasheada. */
export async function audit(evento: Evento, numeroControl?: string | null, detalle: object = {}, ip?: string) {
  const { error } = await db.from('auditoria').insert({
    evento,
    numero_control: numeroControl ?? null,
    detalle,
    ip_hash: ip ? sha256(ip).slice(0, 16) : null,
  })
  if (error) logger.warn({ err: error.message, evento }, 'auditoría no registrada')
}
