import type { Perfil } from './academico.js'

export type TipoVacante = 'servicio_social' | 'residencia' | 'proyecto'

/**
 * Mínimos institucionales por tipo (porcentaje de créditos aprobados).
 * Basados en los lineamientos del TecNM; confirmar con Servicios Escolares / Vinculación.
 */
export const MINIMOS_INSTITUCIONALES: Record<TipoVacante, { avance: number; nota?: string }> = {
  servicio_social: { avance: 70 },
  residencia: { avance: 80, nota: 'También requiere servicio social y actividades complementarias acreditadas.' },
  proyecto: { avance: 0 },
}

export interface Requisitos {
  tipo: TipoVacante
  requisito_avance_min: number
  requisito_promedio_min: number
  requisito_semestre_min: number
}

export interface Check {
  clave: 'avance' | 'promedio' | 'semestre'
  etiqueta: string
  requerido: number
  actual: number
  cumple: boolean
}

export function evaluar(perfil: Perfil, req: Requisitos) {
  const avanceReq = Math.max(Number(req.requisito_avance_min) || 0, MINIMOS_INSTITUCIONALES[req.tipo].avance)
  const checks: Check[] = [
    {
      clave: 'avance',
      etiqueta: 'Avance de créditos',
      requerido: avanceReq,
      actual: perfil.porcentajeAvance,
      cumple: perfil.porcentajeAvance >= avanceReq,
    },
    {
      clave: 'promedio',
      etiqueta: 'Promedio',
      requerido: Number(req.requisito_promedio_min) || 0,
      actual: perfil.promedioPonderado,
      cumple: perfil.promedioPonderado >= (Number(req.requisito_promedio_min) || 0),
    },
    {
      clave: 'semestre',
      etiqueta: 'Semestre',
      requerido: Number(req.requisito_semestre_min) || 1,
      actual: perfil.semestre,
      cumple: perfil.semestre >= (Number(req.requisito_semestre_min) || 1),
    },
  ].filter((c) => c.requerido > 0) as Check[]

  return {
    elegible: checks.every((c) => c.cumple),
    checks,
    nota: MINIMOS_INSTITUCIONALES[req.tipo].nota ?? null,
  }
}

/** Resumen para el dashboard: ¿ya puedo hacer servicio social / residencia? */
export function resumenElegibilidad(perfil: Perfil) {
  return (['servicio_social', 'residencia'] as const).map((tipo) => {
    const req = MINIMOS_INSTITUCIONALES[tipo].avance
    return {
      tipo,
      requerido: req,
      actual: perfil.porcentajeAvance,
      cumple: perfil.porcentajeAvance >= req,
      faltante: Math.max(0, Math.round((req - perfil.porcentajeAvance) * 10) / 10),
      nota: MINIMOS_INSTITUCIONALES[tipo].nota ?? null,
    }
  })
}
