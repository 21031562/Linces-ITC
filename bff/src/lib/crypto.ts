import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'

// SHA-256 del secreto → siempre 32 bytes, acepte hex o base64 (Render generateValue)
const KEY = createHash('sha256').update(config.SESSION_ENC_KEY).digest()

/** AES-256-GCM → "iv.tag.cipher" en base64url. GCM detecta cualquier alteración. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, enc].map((b) => b.toString('base64url')).join('.')
}

export function decrypt(payload: string): string {
  const [iv, tag, enc] = payload.split('.').map((p) => Buffer.from(p, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

/** ID de sesión: 256 bits aleatorios. Solo viaja en la cookie; en BD se guarda su hash. */
export const newSessionId = () => randomBytes(32).toString('base64url')

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}
