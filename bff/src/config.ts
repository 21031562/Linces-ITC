import { z } from 'zod'

const bool = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => v === 'true' || v === '1')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),

  // API institucional (fuente de verdad)
  SII_BASE_URL: z.url().default('https://sii.celaya.tecnm.mx/api'),
  SII_TIMEOUT_MS: z.coerce.number().default(10_000),

  // Supabase A (core): sesiones + auditoría
  SUPABASE_CORE_URL: z.url(),
  SUPABASE_CORE_SECRET_KEY: z.string().min(20),

  // Secreto para derivar la llave AES-256 que cifra el JWT del SII (mín. 32 caracteres aleatorios)
  SESSION_ENC_KEY: z.string().min(32, 'Debe tener al menos 32 caracteres aleatorios'),
  SESSION_IDLE_MINUTES: z.coerce.number().default(20),
  SESSION_MAX_HOURS: z.coerce.number().default(8),
  COOKIE_SECURE: bool,

  // Servicio de vacantes (backend de la funcionalidad adicional)
  VACANTES_URL: z.url(),
  VACANTES_INTERNAL_KEY: z.string().min(24),

  // Defensa en profundidad: solo el gateway del frontend puede llamar al BFF
  // Vacía en .env = desactivada (útil en local)
  GATEWAY_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(24).optional()),
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:3000')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
  TRUST_PROXY: z.coerce.number().default(1),
  LOG_LEVEL: z.string().default('info'),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:')
  for (const issue of parsed.error.issues) console.error(`   - ${issue.path.join('.')}: ${issue.message}`)
  process.exit(1)
}

export const config = parsed.data
export const isProd = config.NODE_ENV === 'production'
export const cookieSecure = isProd || config.COOKIE_SECURE
// Prefijo __Host-: el navegador exige Secure, Path=/ y sin Domain → no se puede sobrescribir desde subdominios
export const SESSION_COOKIE = cookieSecure ? '__Host-linces_sid' : 'linces_sid'
