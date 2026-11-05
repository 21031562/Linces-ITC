import bcrypt from 'bcryptjs'
import { Router } from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { z } from 'zod'
import { ADMIN_COOKIE, config } from '../config.js'
import { newSessionId, sha256 } from '../lib/crypto.js'
import { AppError, notFound } from '../lib/errors.js'
import { check, db } from '../lib/supabase.js'
import { adminCookieOptions, requireAdmin, requireRol } from '../middleware/security.js'

/** Backend de administración de la Bolsa (auth propia, independiente del SII). */
export const adminRouter = Router()

async function bitacora(adminId: string | null, accion: string, entidad: string, entidadId?: string, detalle = {}) {
  await db.from('bitacora_admin').insert({ admin_id: adminId, accion, entidad, entidad_id: entidadId ?? null, detalle })
}

// ── Auth ────────────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 10,
  // Por IP + correo: detrás de varios proxies muchos alumnos pueden compartir IP en la demo
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}:${String(req.body?.email ?? '').toLowerCase()}`,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({ error: { code: 'RATE_LIMIT', message: 'Demasiados intentos. Espera unos minutos.' } }),
})
// Hash de relleno: compara aunque el correo no exista (evita enumerar cuentas por tiempo de respuesta)
const DUMMY_HASH = bcrypt.hashSync('no-existe-este-usuario', 10)

adminRouter.post('/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = z
    .object({
      email: z.string().trim().toLowerCase().pipe(z.email('Correo inválido.')),
      password: z.string().min(1, 'La contraseña es obligatoria.').max(200),
    })
    .parse(req.body ?? {})

  const admin = check(
    await db.from('admins').select('id, email, nombre, rol, activo, password_hash').eq('email', email).maybeSingle(),
  ) as { id: string; email: string; nombre: string; rol: string; activo: boolean; password_hash: string } | null

  const ok = await bcrypt.compare(password, admin?.password_hash ?? DUMMY_HASH)
  if (!admin || !ok || !admin.activo) throw new AppError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.')

  const previa: string | undefined = req.cookies?.[ADMIN_COOKIE]
  if (previa) await db.from('admin_sesiones').delete().eq('id_hash', sha256(previa))

  const sid = newSessionId()
  const expira = new Date(Date.now() + config.ADMIN_SESSION_HOURS * 3_600_000)
  check(await db.from('admin_sesiones').insert({ id_hash: sha256(sid), admin_id: admin.id, expira_en: expira.toISOString() }))
  await db.from('admins').update({ ultimo_login: new Date().toISOString() }).eq('id', admin.id)
  await bitacora(admin.id, 'login', 'admin', admin.id)

  res.cookie(ADMIN_COOKIE, sid, adminCookieOptions(expira))
  res.json({ data: { id: admin.id, email: admin.email, nombre: admin.nombre, rol: admin.rol, expiraEn: expira } })
})

adminRouter.post('/auth/logout', async (req, res) => {
  const sid: string | undefined = req.cookies?.[ADMIN_COOKIE]
  if (sid) await db.from('admin_sesiones').delete().eq('id_hash', sha256(sid))
  res.clearCookie(ADMIN_COOKIE, adminCookieOptions())
  res.json({ data: { ok: true } })
})

// Todo lo de abajo requiere sesión de administrador
adminRouter.use(requireAdmin)

adminRouter.get('/auth/me', (req, res) => {
  const { sesionHash: _omit, ...admin } = req.admin!
  res.json({ data: admin })
})

// ── Estadísticas ────────────────────────────────────────────────────────────
adminRouter.get('/estadisticas', async (_req, res) => {
  const [vacantes, postulaciones] = (await Promise.all([
    db.from('vacantes_resumen').select('id, titulo, tipo, estado, cupo, aceptadas, postulaciones_total').then(check),
    db.from('postulaciones').select('estado, creado_en').then(check),
  ])) as [any[], any[]]
  const contar = <T>(xs: T[], key: (x: T) => string) =>
    xs.reduce<Record<string, number>>((acc, x) => ((acc[key(x)] = (acc[key(x)] ?? 0) + 1), acc), {})

  const dias: { fecha: string; total: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const f = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)
    dias.push({ fecha: f, total: postulaciones.filter((p: any) => String(p.creado_en).slice(0, 10) === f).length })
  }

  res.json({
    data: {
      vacantesPorEstado: contar(vacantes as any[], (v) => v.estado),
      vacantesPorTipo: contar(vacantes as any[], (v) => v.tipo),
      postulacionesPorEstado: contar(postulaciones as any[], (p) => p.estado),
      totalPostulaciones: postulaciones.length,
      lugaresOcupados: (vacantes as any[]).reduce((s, v) => s + Number(v.aceptadas), 0),
      lugaresTotales: (vacantes as any[]).filter((v) => v.estado === 'publicada').reduce((s, v) => s + v.cupo, 0),
      topVacantes: [...(vacantes as any[])]
        .sort((a, b) => b.postulaciones_total - a.postulaciones_total)
        .slice(0, 5)
        .map((v) => ({ id: v.id, titulo: v.titulo, postulaciones: Number(v.postulaciones_total) })),
      ultimos14Dias: dias,
    },
  })
})

// ── Organizaciones ──────────────────────────────────────────────────────────
const orgSchema = z.object({
  nombre: z.string().trim().min(3, 'El nombre es obligatorio.').max(150),
  tipo: z.enum(['empresa', 'dependencia_gobierno', 'interna_itc', 'ong']),
  descripcion: z.string().trim().max(1000).nullish(),
  contacto_nombre: z.string().trim().max(150).nullish(),
  contacto_email: z.email('Correo de contacto inválido.').nullish().or(z.literal('').transform(() => null)),
  sitio_web: z.url('URL inválida.').nullish().or(z.literal('').transform(() => null)),
  activo: z.boolean().optional(),
})

adminRouter.get('/organizaciones', async (_req, res) => {
  res.json({ data: check(await db.from('organizaciones').select('*').order('nombre')) })
})

adminRouter.post('/organizaciones', requireRol('admin'), async (req, res) => {
  const fila = check(await db.from('organizaciones').insert(orgSchema.parse(req.body)).select().single()) as { id: string }
  await bitacora(req.admin!.id, 'crear', 'organizacion', fila.id)
  res.status(201).json({ data: fila })
})

adminRouter.patch('/organizaciones/:id', requireRol('admin'), async (req, res) => {
  const id = z.uuid().parse(req.params.id)
  const fila = check(
    await db.from('organizaciones').update(orgSchema.partial().parse(req.body)).eq('id', id).select().maybeSingle(),
  )
  if (!fila) throw notFound('Organización')
  await bitacora(req.admin!.id, 'editar', 'organizacion', id)
  res.json({ data: fila })
})

adminRouter.delete('/organizaciones/:id', requireRol('admin'), async (req, res) => {
  const id = z.uuid().parse(req.params.id)
  check(await db.from('organizaciones').delete().eq('id', id))
  await bitacora(req.admin!.id, 'eliminar', 'organizacion', id)
  res.json({ data: { ok: true } })
})

// ── Vacantes ────────────────────────────────────────────────────────────────
const vacanteSchema = z.object({
  organizacion_id: z.uuid('Selecciona una organización.'),
  titulo: z.string().trim().min(5, 'El título debe tener al menos 5 caracteres.').max(150),
  tipo: z.enum(['servicio_social', 'residencia', 'proyecto']),
  descripcion: z.string().trim().min(20, 'La descripción debe tener al menos 20 caracteres.').max(3000),
  area: z.string().trim().max(100).nullish(),
  modalidad: z.enum(['presencial', 'remota', 'hibrida']),
  ubicacion: z.string().trim().max(150).nullish(),
  cupo: z.coerce.number().int().min(1, 'El cupo mínimo es 1.').max(200),
  horas_semana: z.coerce.number().int().min(1).max(48).nullish(),
  remunerada: z.boolean().default(false),
  apoyo_economico: z.string().trim().max(150).nullish(),
  requisito_avance_min: z.coerce.number().min(0).max(100).default(0),
  requisito_promedio_min: z.coerce.number().min(0).max(100).default(0),
  requisito_semestre_min: z.coerce.number().int().min(1).max(14).default(1),
  habilidades: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  fecha_limite: z.iso.date('Fecha inválida.').nullish(),
  estado: z.enum(['borrador', 'publicada', 'cerrada']).default('borrador'),
})

adminRouter.get('/vacantes', async (req, res) => {
  const { estado, tipo } = z
    .object({
      estado: z.enum(['borrador', 'publicada', 'cerrada']).optional(),
      tipo: z.enum(['servicio_social', 'residencia', 'proyecto']).optional(),
    })
    .parse(req.query)
  let q = db.from('vacantes_resumen').select('*').order('creado_en', { ascending: false })
  if (estado) q = q.eq('estado', estado)
  if (tipo) q = q.eq('tipo', tipo)
  res.json({ data: check(await q) })
})

adminRouter.get('/vacantes/:id', async (req, res) => {
  const v = check(await db.from('vacantes_resumen').select('*').eq('id', z.uuid().parse(req.params.id)).maybeSingle())
  if (!v) throw notFound('Vacante')
  res.json({ data: v })
})

adminRouter.post('/vacantes', requireRol('admin'), async (req, res) => {
  const fila = check(await db.from('vacantes').insert(vacanteSchema.parse(req.body)).select().single()) as { id: string }
  await bitacora(req.admin!.id, 'crear', 'vacante', fila.id)
  res.status(201).json({ data: fila })
})

adminRouter.patch('/vacantes/:id', requireRol('admin'), async (req, res) => {
  const id = z.uuid().parse(req.params.id)
  const cambios = vacanteSchema.partial().parse(req.body)
  const fila = check(await db.from('vacantes').update(cambios).eq('id', id).select().maybeSingle())
  if (!fila) throw notFound('Vacante')
  await bitacora(req.admin!.id, cambios.estado ? `estado:${cambios.estado}` : 'editar', 'vacante', id)
  res.json({ data: fila })
})

adminRouter.delete('/vacantes/:id', requireRol('admin'), async (req, res) => {
  const id = z.uuid().parse(req.params.id)
  check(await db.from('vacantes').delete().eq('id', id))
  await bitacora(req.admin!.id, 'eliminar', 'vacante', id)
  res.json({ data: { ok: true } })
})

// ── Postulaciones ───────────────────────────────────────────────────────────
adminRouter.get('/postulaciones', async (req, res) => {
  const { vacante_id, estado } = z
    .object({
      vacante_id: z.uuid().optional(),
      estado: z.enum(['pendiente', 'en_revision', 'aceptada', 'rechazada', 'cancelada']).optional(),
    })
    .parse(req.query)
  let q = db
    .from('postulaciones')
    .select('*, vacante:vacantes(id, titulo, tipo, cupo, organizacion:organizaciones(nombre))')
    .order('creado_en', { ascending: false })
  if (vacante_id) q = q.eq('vacante_id', vacante_id)
  if (estado) q = q.eq('estado', estado)
  res.json({ data: check(await q) })
})

adminRouter.patch('/postulaciones/:id', requireRol('admin', 'revisor'), async (req, res) => {
  const id = z.uuid().parse(req.params.id)
  const { estado, comentario_admin } = z
    .object({
      estado: z.enum(['en_revision', 'aceptada', 'rechazada']),
      comentario_admin: z.string().trim().max(1000).nullish(),
    })
    .parse(req.body)

  const actual = check(
    await db.from('postulaciones').select('id, estado, vacante_id').eq('id', id).maybeSingle(),
  ) as { estado: string; vacante_id: string } | null
  if (!actual) throw notFound('Postulación')
  if (actual.estado === 'cancelada') throw new AppError(409, 'CONFLICT', 'El alumno canceló esta postulación.')

  if (estado === 'aceptada' && actual.estado !== 'aceptada') {
    const v = check(
      await db.from('vacantes_resumen').select('lugares_disponibles').eq('id', actual.vacante_id).single(),
    ) as { lugares_disponibles: number }
    if (v.lugares_disponibles <= 0) throw new AppError(409, 'CONFLICT', 'El cupo de la vacante ya está completo.')
  }

  const fila = check(
    await db.from('postulaciones').update({ estado, comentario_admin: comentario_admin ?? null }).eq('id', id).select().single(),
  )
  await bitacora(req.admin!.id, `estado:${estado}`, 'postulacion', id)
  res.json({ data: fila })
})

// ── Bitácora ────────────────────────────────────────────────────────────────
adminRouter.get('/bitacora', requireRol('admin'), async (_req, res) => {
  res.json({
    data: check(
      await db
        .from('bitacora_admin')
        .select('id, accion, entidad, entidad_id, creado_en, admin:admins(nombre, email)')
        .order('creado_en', { ascending: false })
        .limit(100),
    ),
  })
})
