import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4100),

  // Supabase B (vacantes)
  SUPABASE_VACANTES_URL: z.url(),
  SUPABASE_VACANTES_SECRET_KEY: z.string().min(20),

  // Llave que usa el BFF para /internal/* (servidor-a-servidor)
  INTERNAL_KEY: z.string().min(24),
  // Llave del gateway del frontend para /admin/* (opcional en local)
  // Vacía en .env = desactivada (útil en local)
  GATEWAY_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(24).optional()),

  ADMIN_SESSION_HOURS: z.coerce.number().default(8),
  COOKIE_SECURE: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => v === 'true' || v === '1'),
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
  for (const i of parsed.error.issues) console.error(`   - ${i.path.join('.')}: ${i.message}`)
  process.exit(1)
}

export const config = parsed.data
export const cookieSecure = config.NODE_ENV === 'production' || config.COOKIE_SECURE
export const ADMIN_COOKIE = cookieSecure ? '__Host-linces_admin' : 'linces_admin'
