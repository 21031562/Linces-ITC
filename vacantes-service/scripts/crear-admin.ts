/**
 * Crea (o actualiza la contraseña de) un administrador de la Bolsa.
 * Uso:  npm run crear-admin -- correo@ejemplo.com "Contraseña-Segura-123" "Nombre" [admin|revisor]
 */
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

const [email, password, nombre = 'Administrador', rol = 'admin'] = process.argv.slice(2)
if (!email || !password) {
  console.error('Uso: npm run crear-admin -- <email> <password> [nombre] [admin|revisor]')
  process.exit(1)
}
if (password.length < 10) {
  console.error('La contraseña debe tener al menos 10 caracteres.')
  process.exit(1)
}
if (!['admin', 'revisor'].includes(rol)) {
  console.error('El rol debe ser admin o revisor.')
  process.exit(1)
}

const db = createClient(process.env.SUPABASE_VACANTES_URL!, process.env.SUPABASE_VACANTES_SECRET_KEY!, {
  auth: { persistSession: false },
})

const password_hash = await bcrypt.hash(password, 12)
const { error } = await db
  .from('admins')
  .upsert({ email: email.toLowerCase(), nombre, rol, password_hash, activo: true }, { onConflict: 'email' })

if (error) {
  console.error('❌', error.message)
  process.exit(1)
}
console.log(`✅ Administrador listo: ${email.toLowerCase()} (${rol})`)
