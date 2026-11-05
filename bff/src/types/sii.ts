// Formas crudas que devuelve el API SII ITC (campo `data` de cada respuesta)

export interface SiiEstudiante {
  numero_control: string
  persona: string
  email: string
  semestre: number
  num_mat_rep_no_acreditadas: string
  creditos_acumulados: string
  promedio_ponderado: string
  promedio_aritmetico: string
  materias_cursadas: string
  materias_reprobadas: string
  materias_aprobadas: string
  creditos_complementarios: number
  porcentaje_avance: number
  num_materias_rep_primera: number | null
  num_materias_rep_segunda: number | null
  percentaje_avance_cursando: number
  foto: string | null
}

export interface SiiPeriodo {
  clave_periodo: string
  anio: number
  descripcion_periodo: string
}

export interface SiiCalificacionesPeriodo {
  periodo: SiiPeriodo
  materias: {
    materia: { id_grupo: number; nombre_materia: string; clave_materia: string; letra_grupo: string }
    // "calificaiones" (sic): así viene escrito en el API real
    calificaiones: { id_calificacion: number; numero_calificacion: number; calificacion: string | null }[]
  }[]
}

export interface SiiKardexItem {
  nombre_materia: string
  clave_materia: string
  periodo: string
  creditos: string
  calificacion: string
  descripcion: string
  semestre: number
}

export interface SiiKardex {
  porcentaje_avance: number
  kardex: SiiKardexItem[]
}

type Dia = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado'

export type SiiHorarioItem = {
  id_grupo: number
  letra_grupo: string
  nombre_materia: string
  clave_materia: string
  clave_turno: string
  nombre_plan: string
  letra_nivel: string
} & { [K in Dia]: string | null } & { [K in `${Dia}_clave_salon`]: string | null }

export interface SiiHorarioPeriodo {
  periodo: SiiPeriodo
  horario: SiiHorarioItem[]
}
