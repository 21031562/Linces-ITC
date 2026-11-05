import { createClient } from '@supabase/supabase-js'
import { config } from '../config.js'

// Secret key de Supabase B: solo vive en este servicio
export const db = createClient(config.SUPABASE_VACANTES_URL, config.SUPABASE_VACANTES_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** Lanza el error de PostgREST/Postgres como excepción para no repetir `if (error)` */
export function check<T>(r: { data: T; error: { message: string; code?: string } | null }): T {
  if (r.error) {
    const e = new Error(r.error.message) as Error & { pgCode?: string }
    e.pgCode = r.error.code
    throw e
  }
  return r.data
}
