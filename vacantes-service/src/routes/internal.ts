import { Router } from 'express'
import { z } from 'zod'
import { AppError, notFound } from '../lib/errors.js'
import { check, db } from '../lib/supabase.js'

/**
 * API interna consumida SOLO por el BFF (llave x-internal-key).
 * El BFF ya autenticó al alumno contra el SII y validó su elegibilidad.
 */
export const internalRouter = Router()

const hoy = () => new Date().toISOString().slice(0, 10)
const COLUMNAS_PUBLICAS =
  'id, titulo, tipo, descripcion, area, modalidad, ubicacion, cupo, horas_semana, remunerada, apoyo_economico, ' +
  'requisito_avance_min, requisito_promedio_min, requisito_semestre_min, habilidades, fecha_limite, estado, ' +
  'organizacion_nombre, organizacion_tipo, postulaciones_total, lugares_disponibles, creado_en'

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

internalRouter.get('/vacantes', async (req, res) => {
  const { tipo, q } = z
    .object({ tipo: z.enum(['servicio_social', 'residencia', 'proyecto']).optional(), q: z.string().max(80).optional() })
    .parse(req.query)

  let query = db
    .from('vacantes_resumen')
    .select(COLUMNAS_PUBLICAS)
    .eq('estado', 'publicada')
    .or(`fecha_limite.is.null,fecha_limite.gte.${hoy()}`)
    .order('fecha_limite', { ascending: true, nullsFirst: false })
  if (tipo) query = query.eq('tipo', tipo)

  let rows = check(await query) as unknown as Record<string, any>[]
  if (q) {
    const term = norm(q)
    rows = rows.filter((v) =>
      [v.titulo, v.descripcion, v.area, v.organizacion_nombre, ...(v.habilidades ?? [])].some((f) =>
        norm(String(f ?? '')).includes(term),
      ),
    )
  }
  res.json({ data: rows })
})

internalRouter.get('/vacantes/:id', async (req, res) => {
  const id = z.uuid().parse(req.params.id)
  const v = check(
    await db.from('vacantes_resumen').select(COLUMNAS_PUBLICAS).eq('id', id).eq('estado', 'publicada').maybeSingle(),
  )
  if (!v) throw notFound('Vacante')
  res.json({ data: v })
})

internalRouter.get('/postulaciones', async (req, res) => {
  const { numero_control, detalle } = z
    .object({ numero_control: z.string().min(4).max(20), detalle: z.string().optional() })
    .parse(req.query)
  const cols = detalle
    ? 'id, vacante_id, estado, mensaje, comentario_admin, creado_en, actualizado_en, ' +
      'vacante:vacantes(id, titulo, tipo, modalidad, fecha_limite, organizacion:organizaciones(nombre))'
    : 'id, vacante_id, estado, creado_en'
  const rows = check(
    await db.from('postulaciones').select(cols).eq('numero_control', numero_control).order('creado_en', { ascending: false }),
  )
  res.json({ data: rows })
})

const crearSchema = z.object({
  vacante_id: z.uuid(),
  numero_control: z.string().min(4).max(20),
  nombre: z.string().min(1).max(200),
  email: z.email(),
  mensaje: z.string().min(20).max(1000),
  snapshot: z.record(z.string(), z.unknown()),
})

internalRouter.post('/postulaciones', async (req, res) => {
  const body = crearSchema.parse(req.body)

  const v = check(
    await db
      .from('vacantes_resumen')
      .select('id, estado, fecha_limite, lugares_disponibles')
      .eq('id', body.vacante_id)
      .maybeSingle(),
  ) as { estado: string; fecha_limite: string | null; lugares_disponibles: number } | null
  if (!v || v.estado !== 'publicada') throw new AppError(410, 'GONE', 'La vacante ya no está disponible.')
  if (v.fecha_limite && v.fecha_limite < hoy()) throw new AppError(410, 'GONE', 'La fecha límite ya pasó.')
  if (v.lugares_disponibles <= 0) throw new AppError(410, 'GONE', 'La vacante ya no tiene lugares disponibles.')

  const previa = check(
    await db
      .from('postulaciones')
      .select('id, estado')
      .eq('vacante_id', body.vacante_id)
      .eq('numero_control', body.numero_control)
      .maybeSingle(),
  ) as { id: string; estado: string } | null

  if (previa && previa.estado !== 'cancelada') {
    throw new AppError(409, 'CONFLICT', 'Ya te postulaste a esta vacante.')
  }

  const fila = previa
    ? check(
        await db
          .from('postulaciones')
          .update({ estado: 'pendiente', mensaje: body.mensaje, snapshot: body.snapshot, comentario_admin: null })
          .eq('id', previa.id)
          .select()
          .single(),
      )
    : check(await db.from('postulaciones').insert(body).select().single())

  res.status(201).json({ data: fila })
})

internalRouter.post('/postulaciones/:id/cancelar', async (req, res) => {
  const id = z.uuid().parse(req.params.id)
  const { numero_control } = z.object({ numero_control: z.string().min(4) }).parse(req.body)
  const fila = check(
    await db
      .from('postulaciones')
      .update({ estado: 'cancelada' })
      .eq('id', id)
      .eq('numero_control', numero_control) // un alumno solo cancela las suyas
      .in('estado', ['pendiente', 'en_revision'])
      .select('id, estado')
      .maybeSingle(),
  )
  if (!fila) throw new AppError(409, 'CONFLICT', 'Esta postulación ya no se puede cancelar.')
  res.json({ data: fila })
})
