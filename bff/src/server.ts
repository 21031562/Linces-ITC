import { config } from './config.js'
import { createApp } from './app.js'
import { logger } from './lib/logger.js'
import { db } from './lib/supabase.js'

const app = createApp()

app.listen(config.PORT, () => {
  logger.info(`BFF escuchando en :${config.PORT} (${config.NODE_ENV})`)
})

// Limpieza periódica de sesiones vencidas
setInterval(
  () => {
    void db.rpc('limpiar_sesiones_vencidas').then(({ data, error }) => {
      if (error) logger.warn({ err: error.message }, 'limpieza de sesiones falló')
      else if (data) logger.info({ borradas: data }, 'sesiones vencidas eliminadas')
    })
  },
  30 * 60_000,
).unref()
