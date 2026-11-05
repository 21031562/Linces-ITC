import { Router } from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { z } from 'zod'
import { SESSION_COOKIE } from '../config.js'
import { AppError } from '../lib/errors.js'
import { sii } from '../lib/sii.js'
import { siiLogin } from '../lib/sii.js'
import { audit } from '../services/audit.js'
import { createSession, destroySession, hashSid } from '../services/sessionStore.js'
import { olvidarPerfil } from './vacantes.js'
import { clearSessionCookie, cookieOptions, requireSession } from '../middleware/session.js'

export const authRouter = Router()

const loginLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 10,
  // Por IP + correo: detrás de varios proxies muchos alumnos pueden compartir IP en la demo
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}:${String(req.body?.email ?? '').toLowerCase()}`,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      error: { code: 'RATE_LIMIT', message: 'Demasiados intentos. Espera unos minutos antes de volver a intentar.' },
    }),
})

const loginSchema = z.object({
  email: z
    .string({ error: 'El correo es obligatorio.' })
    .trim()
    .min(1, 'El correo es obligatorio.')
    .pipe(z.email('Escribe un correo válido.')),
  password: z.string({ error: 'La contraseña es obligatoria.' }).min(1, 'La contraseña es obligatoria.').max(200),
})

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body ?? {})

  let token: string
  try {
    token = await siiLogin(email, password)
  } catch (err) {
    if (err instanceof AppError && err.code === 'INVALID_CREDENTIALS') {
      void audit('login_fallido', null, { dominio: email.split('@')[1] ?? null }, req.ip)
    }
    throw err
  }

  // Si el navegador traía una sesión anterior, se revoca (evita sesiones huérfanas / fijación de sesión)
  const previa: string | undefined = req.cookies?.[SESSION_COOKIE]
  if (previa) await destroySession(hashSid(previa)).catch(() => {})

  // Necesitamos el número de control para ligar la sesión (y la bolsa de vacantes)
  const est = await sii.estudiante(token)
  const { sid, expiraEn } = await createSession({
    token,
    numeroControl: est.numero_control,
    userAgent: req.get('user-agent'),
  })
  void audit('login_ok', est.numero_control, {}, req.ip)

  res.cookie(SESSION_COOKIE, sid, cookieOptions(expiraEn))
  // Ojo: la respuesta NO incluye el token. El navegador nunca lo ve.
  res.json({ data: { autenticado: true, expiraEn: expiraEn.toISOString(), nombre: est.persona } })
})

authRouter.get('/session', requireSession, (req, res) => {
  res.json({
    data: {
      autenticado: true,
      numeroControl: req.sesion!.numeroControl,
      expiraEn: req.sesion!.expiraEn.toISOString(),
    },
  })
})

authRouter.post('/logout', async (req, res) => {
  const sid: string | undefined = req.cookies?.[SESSION_COOKIE]
  if (sid) {
    await destroySession(hashSid(sid)).catch(() => {})
    olvidarPerfil(hashSid(sid))
    void audit('logout', null, {}, req.ip)
  }
  clearSessionCookie(res)
  res.json({ data: { autenticado: false } })
})
