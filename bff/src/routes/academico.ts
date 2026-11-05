import { Router } from 'express'
import { sii } from '../lib/sii.js'
import * as A from '../services/academico.js'
import { resumenElegibilidad } from '../services/elegibilidad.js'

/**
 * Endpoints académicos. Cada uno consulta el SII en vivo con el JWT descifrado del lado servidor
 * y devuelve datos ya normalizados (lógica de negocio del backend local).
 */
export const academicoRouter = Router()

academicoRouter.get('/estudiante', async (req, res) => {
  const perfil = A.perfil(await sii.estudiante(req.sesion!.token))
  res.json({ data: { ...perfil, elegibilidad: resumenElegibilidad(perfil) } })
})

academicoRouter.get('/calificaciones', async (req, res) => {
  res.json({ data: A.calificaciones(await sii.calificaciones(req.sesion!.token)) })
})

academicoRouter.get('/kardex', async (req, res) => {
  res.json({ data: A.kardex(await sii.kardex(req.sesion!.token)) })
})

academicoRouter.get('/horario', async (req, res) => {
  res.json({ data: A.horario(await sii.horarios(req.sesion!.token)) })
})
