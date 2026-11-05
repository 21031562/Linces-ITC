import { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../lib/errors.js'
import { sii } from '../lib/sii.js'
import { perfil as toPerfil, type Perfil } from '../services/academico.js'
import { audit } from '../services/audit.js'
import { evaluar, type Requisitos } from '../services/elegibilidad.js'
import { vacantesApi } from '../services/vacantesClient.js'

/**
 * Gateway de la funcionalidad adicional (Bolsa de Servicio Social, Residencias y Proyectos).
 * El BFF cruza los requisitos de cada vacante con los datos REALES del SII del alumno.
 * El frontend nunca decide quién es elegible: se valida aquí, del lado servidor.
 */
export const vacantesRouter = Router()

type Vacante = Requisitos & {
  id: string
  titulo: string
  estado: string
  fecha_limite: string | null
  lugares_disponibles: number
  [k: string]: unknown
}
type Postulacion = { id: string; vacante_id: string; estado: string; [k: string]: unknown }

// Caché corta en memoria del perfil (solo para listar). Al postular siempre se consulta el SII en vivo.
const perfilCache = new Map<string, { perfil: Perfil; at: number }>()
async function perfilDe(idHash: string, token: string, fresco = false): Promise<Perfil> {
  const hit = perfilCache.get(idHash)
  if (!fresco && hit && Date.now() - hit.at < 120_000) return hit.perfil
  const perfil = toPerfil(await sii.estudiante(token))
  perfilCache.set(idHash, { perfil, at: Date.now() })
  if (perfilCache.size > 500) perfilCache.delete(perfilCache.keys().next().value!)
  return perfil
}

export const olvidarPerfil = (idHash: string) => perfilCache.delete(idHash)

const listQuery = z.object({
  tipo: z.enum(['servicio_social', 'residencia', 'proyecto']).optional(),
  q: z.string().trim().max(80).optional(),
})

vacantesRouter.get('/vacantes', async (req, res) => {
  const { tipo, q } = listQuery.parse(req.query)
  const s = req.sesion!
  const params = new URLSearchParams()
  if (tipo) params.set('tipo', tipo)
  if (q) params.set('q', q)

  const [perfil, vacantes, mias] = await Promise.all([
    perfilDe(s.idHash, s.token),
    vacantesApi<Vacante[]>(`/vacantes?${params}`),
    vacantesApi<Postulacion[]>(`/postulaciones?numero_control=${encodeURIComponent(s.numeroControl)}`),
  ])
  const porVacante = new Map(mias.map((p) => [p.vacante_id, p]))

  res.json({
    data: vacantes.map((v) => ({
      ...v,
      elegibilidad: evaluar(perfil, v),
      miPostulacion: porVacante.get(v.id) ?? null,
    })),
  })
})

vacantesRouter.get('/vacantes/:id', async (req, res) => {
  const id = z.uuid().parse(req.params.id)
  const s = req.sesion!
  const [perfil, v, mias] = await Promise.all([
    perfilDe(s.idHash, s.token),
    vacantesApi<Vacante>(`/vacantes/${id}`),
    vacantesApi<Postulacion[]>(`/postulaciones?numero_control=${encodeURIComponent(s.numeroControl)}`),
  ])
  res.json({
    data: { ...v, elegibilidad: evaluar(perfil, v), miPostulacion: mias.find((p) => p.vacante_id === v.id) ?? null },
  })
})

const postularSchema = z.object({
  mensaje: z.string().trim().min(20, 'Cuéntales en al menos 20 caracteres por qué te interesa.').max(1000),
})

vacantesRouter.post('/vacantes/:id/postulaciones', async (req, res) => {
  const id = z.uuid().parse(req.params.id)
  const { mensaje } = postularSchema.parse(req.body ?? {})
  const s = req.sesion!

  // Datos frescos del SII: la elegibilidad se valida con la fuente de verdad
  const [perfil, v] = await Promise.all([perfilDe(s.idHash, s.token, true), vacantesApi<Vacante>(`/vacantes/${id}`)])
  const ev = evaluar(perfil, v)
  if (!ev.elegible) {
    const faltan = ev.checks.filter((c) => !c.cumple).map((c) => `${c.etiqueta} (${c.actual} de ${c.requerido})`)
    throw new AppError(422, 'NOT_ELIGIBLE', `Aún no cumples los requisitos: ${faltan.join(', ')}.`)
  }

  const creada = await vacantesApi<Postulacion>('/postulaciones', {
    method: 'POST',
    body: JSON.stringify({
      vacante_id: id,
      numero_control: perfil.numeroControl,
      nombre: perfil.nombre,
      email: perfil.email,
      mensaje,
      // Evidencia mínima de elegibilidad al momento de postular
      snapshot: {
        porcentaje_avance: perfil.porcentajeAvance,
        promedio_ponderado: perfil.promedioPonderado,
        semestre: perfil.semestre,
        creditos_acumulados: perfil.creditosAcumulados,
        validado_en: new Date().toISOString(),
      },
    }),
  })
  void audit('postulacion', perfil.numeroControl, { vacante_id: id })
  res.status(201).json({ data: creada })
})

vacantesRouter.get('/postulaciones', async (req, res) => {
  const nc = encodeURIComponent(req.sesion!.numeroControl)
  res.json({ data: await vacantesApi<Postulacion[]>(`/postulaciones?numero_control=${nc}&detalle=1`) })
})

vacantesRouter.post('/postulaciones/:id/cancelar', async (req, res) => {
  const id = z.uuid().parse(req.params.id)
  const data = await vacantesApi<Postulacion>(`/postulaciones/${id}/cancelar`, {
    method: 'POST',
    body: JSON.stringify({ numero_control: req.sesion!.numeroControl }),
  })
  void audit('cancelacion', req.sesion!.numeroControl, { postulacion_id: id })
  res.json({ data })
})
