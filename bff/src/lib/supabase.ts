import { createClient } from '@supabase/supabase-js'
import { config } from '../config.js'

// Secret key (o service_role legacy): SOLO vive en el servidor. Nunca en el frontend.
export const db = createClient(config.SUPABASE_CORE_URL, config.SUPABASE_CORE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
