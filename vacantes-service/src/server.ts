import { config } from './config.js'
import { createApp } from './app.js'
import { logger } from './lib/logger.js'
import { db } from './lib/supabase.js'

createApp().listen(config.PORT, () => {
  logger.info(`vacantes-service escuchando en :${config.PORT} (${config.NODE_ENV})`)
})

// Limpieza periódica de sesiones de administrador vencidas
setInterval(
  () => {
    void db
      .from('admin_sesiones')
      .delete()
      .lt('expira_en', new Date().toISOString())
      .then(({ error }) => error && logger.warn({ err: error.message }, 'limpieza de sesiones admin falló'))
  },
  30 * 60_000,
).unref()
