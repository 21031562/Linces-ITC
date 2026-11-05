import type { EstadoPostulacion, TipoVacante } from './types'

const minus = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'en', 'a', 'el', 'por', 'para', 'con', 'i', 'ii', 'iii', 'iv'])
const romanos = new Set(['i', 'ii', 'iii', 'iv', 'v', 'vi'])

/** "TOPICOS AVANZADOS DE DESARROLLO WEB" → "Topicos Avanzados de Desarrollo Web" */
export function titulo(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => {
      if (romanos.has(w)) return w.toUpperCase()
      if (i > 0 && minus.has(w)) return w
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}

/** El SII da "APELLIDO1 APELLIDO2 NOMBRE(S)" → nombre de pila */
export function nombrePila(persona: string): string {
  const partes = persona.trim().split(/\s+/)
  const nombres = partes.length >= 3 ? partes.slice(2) : partes
  return titulo(nombres[0] ?? persona)
}

export const nombreCompleto = (persona: string) => {
  const p = persona.trim().split(/\s+/)
  return p.length >= 3 ? titulo([...p.slice(2), ...p.slice(0, 2)].join(' ')) : titulo(persona)
}

export const n1 = (v: number | null | undefined, dec = 1) =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : v.toLocaleString('es-MX', { maximumFractionDigits: dec })

export const TIPO_LABEL: Record<TipoVacante, string> = {
  servicio_social: 'Servicio social',
  residencia: 'Residencia profesional',
  proyecto: 'Proyecto',
}

export const MODALIDAD_LABEL: Record<string, string> = { presencial: 'Presencial', remota: 'Remota', hibrida: 'Híbrida' }

export const ESTADO_LABEL: Record<EstadoPostulacion, string> = {
  pendiente: 'Enviada',
  en_revision: 'En revisión',
  aceptada: 'Aceptada',
  rechazada: 'No seleccionada',
  cancelada: 'Cancelada',
}

export const ORG_TIPO_LABEL: Record<string, string> = {
  empresa: 'Empresa',
  dependencia_gobierno: 'Dependencia de gobierno',
  interna_itc: 'Área del ITC',
  ong: 'Organización civil',
}

export function diasRestantes(fecha: string | null): number | null {
  if (!fecha) return null
  const fin = new Date(`${fecha}T23:59:59`)
  return Math.ceil((fin.getTime() - Date.now()) / 86_400_000)
}

export const fechaCorta = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

export const DIA_LABEL = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
} as const

export const DIA_HOY = (['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const)[new Date().getDay()]
