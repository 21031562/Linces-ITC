import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const newSessionId = () => randomBytes(32).toString('base64url')
export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}
