/**
 * Lógica de negocio sobre los datos del SII.
 * Se calcula al vuelo en cada petición: no se persiste nada académico (el SII es la fuente de verdad).
 */
import type {
  SiiCalificacionesPeriodo,
  SiiEstudiante,
  SiiHorarioPeriodo,
  SiiKardex,
} from '../types/sii.js'

export const CALIFICACION_APROBATORIA = 70
export const UMBRAL_VERDE = 85

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
const round1 = (n: number) => Math.round(n * 10) / 10
const avg = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null)

export type Semaforo = 'verde' | 'amarillo' | 'rojo' | 'gris'

export function semaforo(cal: number | null, unidadesReprobadas = 0): Semaforo {
  if (cal === null) return 'gris'
  if (cal < CALIFICACION_APROBATORIA) return 'rojo'
  if (cal >= UMBRAL_VERDE && unidadesReprobadas === 0) return 'verde'
  return 'amarillo'
}

// ── Perfil ──────────────────────────────────────────────────────────────────
function normalizarFoto(foto: string | null | undefined): string | null {
  if (!foto) return null
  const f = foto.trim()
  if (f.startsWith('data:image/') || f.startsWith('https://')) return f
  if (/^[A-Za-z0-9+/=\s]+$/.test(f) && f.length > 100) {
    const mime = f.startsWith('iVBOR') ? 'image/png' : 'image/jpeg'
    return `data:${mime};base64,${f.replace(/\s/g, '')}`
  }
  return null
}

export function perfil(e: SiiEstudiante) {
  return {
    numeroControl: e.numero_control,
    nombre: e.persona,
    email: e.email,
    semestre: Number(e.semestre) || 0,
    foto: normalizarFoto(e.foto),
    promedioPonderado: num(e.promedio_ponderado) ?? 0,
    promedioAritmetico: num(e.promedio_aritmetico) ?? 0,
    creditosAcumulados: num(e.creditos_acumulados) ?? 0,
    creditosComplementarios: Number(e.creditos_complementarios) || 0,
    porcentajeAvance: Number(e.porcentaje_avance) || 0,
    porcentajeAvanceCursando: Number(e.percentaje_avance_cursando) || 0,
    materiasCursadas: num(e.materias_cursadas) ?? 0,
    materiasAprobadas: num(e.materias_aprobadas) ?? 0,
    materiasReprobadas: num(e.materias_reprobadas) ?? 0,
    materiasNoAcreditadas: num(e.num_mat_rep_no_acreditadas) ?? 0,
  }
}
export type Perfil = ReturnType<typeof perfil>

// ── Calificaciones ──────────────────────────────────────────────────────────
export function calificaciones(periodos: SiiCalificacionesPeriodo[]) {
  const materias = (periodos ?? []).flatMap((p) =>
    (p.materias ?? []).map((m) => {
      const parciales = [...(m.calificaiones ?? [])]
        .sort((a, b) => a.numero_calificacion - b.numero_calificacion)
        .map((c) => ({ unidad: c.numero_calificacion, valor: num(c.calificacion) }))
      const capturadas = parciales.map((p) => p.valor).filter((v): v is number => v !== null)
      const final = avg(capturadas)
      const unidadesReprobadas = capturadas.filter((v) => v < CALIFICACION_APROBATORIA).length
      const estado =
        final === null
          ? 'sin_captura'
          : final < CALIFICACION_APROBATORIA
            ? 'reprobando'
            : unidadesReprobadas > 0
              ? 'en_riesgo'
              : 'aprobando'
      return {
        periodo: {
          clave: p.periodo.clave_periodo,
          descripcion: p.periodo.descripcion_periodo,
          anio: p.periodo.anio,
        },
        clave: m.materia.clave_materia,
        nombre: m.materia.nombre_materia,
        grupo: m.materia.letra_grupo,
        parciales,
        final,
        unidadesReprobadas,
        estado,
        semaforo: semaforo(final, unidadesReprobadas),
      }
    }),
  )
  const finales = materias.map((m) => m.final).filter((v): v is number => v !== null)
  return {
    periodos: (periodos ?? []).map((p) => ({
      clave: p.periodo.clave_periodo,
      descripcion: p.periodo.descripcion_periodo,
      anio: p.periodo.anio,
    })),
    materias,
    resumen: {
      materias: materias.length,
      promedio: avg(finales),
      verdes: materias.filter((m) => m.semaforo === 'verde').length,
      amarillas: materias.filter((m) => m.semaforo === 'amarillo').length,
      rojas: materias.filter((m) => m.semaforo === 'rojo').length,
    },
    criterio: {
      final: 'Promedio de las unidades capturadas hasta el momento',
      verde: `≥ ${UMBRAL_VERDE} sin unidades reprobadas`,
      amarillo: `${CALIFICACION_APROBATORIA}–${UMBRAL_VERDE - 1} o con alguna unidad < ${CALIFICACION_APROBATORIA}`,
      rojo: `< ${CALIFICACION_APROBATORIA}`,
    },
  }
}

// ── Kardex ──────────────────────────────────────────────────────────────────
const TEXTO_ACREDITADA = /^(AC|ACA|ACREDITAD[AO]|APROBAD[AO])$/i

export function kardex(k: SiiKardex) {
  const items = (k?.kardex ?? []).map((i) => {
    const cal = num(i.calificacion)
    const aprobada = cal !== null ? cal >= CALIFICACION_APROBATORIA : TEXTO_ACREDITADA.test(i.calificacion?.trim() ?? '')
    return {
      clave: i.clave_materia,
      nombre: i.nombre_materia,
      periodo: i.periodo,
      semestre: Number(i.semestre) || 0,
      creditos: num(i.creditos) ?? 0,
      calificacion: cal,
      calificacionTexto: i.calificacion,
      tipoEvaluacion: i.descripcion,
      aprobada,
      semaforo: cal === null ? (aprobada ? 'verde' : 'gris') : semaforo(cal),
    }
  })

  const porSemestre = new Map<number, typeof items>()
  for (const it of items) porSemestre.set(it.semestre, [...(porSemestre.get(it.semestre) ?? []), it])

  const semestres = [...porSemestre.entries()]
    .sort(([a], [b]) => a - b)
    .map(([semestre, materias]) => ({
      semestre,
      materias,
      creditos: materias.filter((m) => m.aprobada).reduce((s, m) => s + m.creditos, 0),
      promedio: avg(materias.filter((m) => m.aprobada && m.calificacion !== null).map((m) => m.calificacion!)),
    }))

  const aprobadas = items.filter((i) => i.aprobada)
  return {
    porcentajeAvance: Number(k?.porcentaje_avance) || 0,
    resumen: {
      materias: items.length,
      aprobadas: aprobadas.length,
      noAprobadas: items.length - aprobadas.length,
      creditosAprobados: aprobadas.reduce((s, m) => s + m.creditos, 0),
      promedio: avg(aprobadas.filter((m) => m.calificacion !== null).map((m) => m.calificacion!)),
    },
    semestres,
  }
}

// ── Horario ─────────────────────────────────────────────────────────────────
export const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const
const RANGO = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/
const pad = (h: string, m: string) => `${h.padStart(2, '0')}:${m}`

export function horario(periodos: SiiHorarioPeriodo[]) {
  const p = periodos?.[0]
  if (!p) return { periodo: null, materias: [], dias: [...DIAS.slice(0, 5)], horaInicio: 7, horaFin: 15 }

  let min = 24
  let max = 0
  const materias = (p.horario ?? []).map((h, idx) => {
    const sesiones = DIAS.flatMap((dia) => {
      const raw = h[dia]
      const m = raw ? RANGO.exec(raw) : null
      if (!m) return []
      const [, h1, m1, h2, m2] = m
      min = Math.min(min, Number(h1))
      max = Math.max(max, Number(h2) + (Number(m2) > 0 ? 1 : 0))
      return [{ dia, inicio: pad(h1, m1), fin: pad(h2, m2), salon: h[`${dia}_clave_salon`] ?? null }]
    })
    return {
      clave: h.clave_materia,
      nombre: h.nombre_materia,
      grupo: h.letra_grupo,
      color: idx % 10,
      sesiones,
    }
  })

  const usaSabado = materias.some((m) => m.sesiones.some((s) => s.dia === 'sabado'))
  return {
    periodo: { clave: p.periodo.clave_periodo, descripcion: p.periodo.descripcion_periodo, anio: p.periodo.anio },
    plan: p.horario?.[0]?.nombre_plan ?? null,
    turno: p.horario?.[0]?.clave_turno ?? null,
    materias,
    dias: usaSabado ? [...DIAS] : [...DIAS.slice(0, 5)],
    horaInicio: min === 24 ? 7 : min,
    horaFin: max === 0 ? 15 : max,
  }
}
