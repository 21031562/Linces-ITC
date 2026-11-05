/**
 * Lee el claim `exp` del JWT del SII SIN verificar la firma (no tenemos la llave del SII).
 * Solo se usa para saber cuándo caduca; quien valida el token es el propio SII en cada petición.
 */
export function jwtExpiration(token: string): Date | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number }
    return typeof json.exp === 'number' ? new Date(json.exp * 1000) : null
  } catch {
    return null
  }
}
