export type Semaforo = 'verde' | 'amarillo' | 'rojo' | 'gris'
export type TipoVacante = 'servicio_social' | 'residencia' | 'proyecto'

export interface Elegibilidad {
  tipo: 'servicio_social' | 'residencia'
  requerido: number
  actual: number
  cumple: boolean
  faltante: number
  nota: string | null
}

export interface Perfil {
  numeroControl: string
  nombre: string
  email: string
  semestre: number
  foto: string | null
  promedioPonderado: number
  promedioAritmetico: number
  creditosAcumulados: number
  creditosComplementarios: number
  porcentajeAvance: number
  porcentajeAvanceCursando: number
  materiasCursadas: number
  materiasAprobadas: number
  materiasReprobadas: number
  materiasNoAcreditadas: number
  elegibilidad: Elegibilidad[]
}

export interface Periodo {
  clave: string
  descripcion: string
  anio: number
}

export interface MateriaCalificacion {
  periodo: Periodo
  clave: string
  nombre: string
  grupo: string
  parciales: { unidad: number; valor: number | null }[]
  final: number | null
  unidadesReprobadas: number
  estado: 'aprobando' | 'en_riesgo' | 'reprobando' | 'sin_captura'
  semaforo: Semaforo
}

export interface Calificaciones {
  periodos: Periodo[]
  materias: MateriaCalificacion[]
  resumen: { materias: number; promedio: number | null; verdes: number; amarillas: number; rojas: number }
  criterio: { final: string; verde: string; amarillo: string; rojo: string }
}

export interface KardexMateria {
  clave: string
  nombre: string
  periodo: string
  semestre: number
  creditos: number
  calificacion: number | null
  calificacionTexto: string
  tipoEvaluacion: string
  aprobada: boolean
  semaforo: Semaforo
}

export interface Kardex {
  porcentajeAvance: number
  resumen: { materias: number; aprobadas: number; noAprobadas: number; creditosAprobados: number; promedio: number | null }
  semestres: { semestre: number; materias: KardexMateria[]; creditos: number; promedio: number | null }[]
}

export type Dia = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado'

export interface Horario {
  periodo: Periodo | null
  plan?: string | null
  turno?: string | null
  materias: {
    clave: string
    nombre: string
    grupo: string
    color: number
    sesiones: { dia: Dia; inicio: string; fin: string; salon: string | null }[]
  }[]
  dias: Dia[]
  horaInicio: number
  horaFin: number
}

export interface Check {
  clave: 'avance' | 'promedio' | 'semestre'
  etiqueta: string
  requerido: number
  actual: number
  cumple: boolean
}

export type EstadoPostulacion = 'pendiente' | 'en_revision' | 'aceptada' | 'rechazada' | 'cancelada'

export interface Vacante {
  id: string
  titulo: string
  tipo: TipoVacante
  descripcion: string
  area: string | null
  modalidad: 'presencial' | 'remota' | 'hibrida'
  ubicacion: string | null
  cupo: number
  horas_semana: number | null
  remunerada: boolean
  apoyo_economico: string | null
  requisito_avance_min: number
  requisito_promedio_min: number
  requisito_semestre_min: number
  habilidades: string[]
  fecha_limite: string | null
  estado: 'borrador' | 'publicada' | 'cerrada'
  organizacion_nombre: string
  organizacion_tipo: string
  postulaciones_total: number
  lugares_disponibles: number
  organizacion_id?: string
  aceptadas?: number
  elegibilidad?: { elegible: boolean; checks: Check[]; nota: string | null }
  miPostulacion?: { id: string; estado: EstadoPostulacion } | null
}

export interface MiPostulacion {
  id: string
  vacante_id: string
  estado: EstadoPostulacion
  mensaje: string
  comentario_admin: string | null
  creado_en: string
  actualizado_en: string
  vacante: {
    id: string
    titulo: string
    tipo: TipoVacante
    modalidad: string
    fecha_limite: string | null
    organizacion: { nombre: string }
  } | null
}

export interface Organizacion {
  id: string
  nombre: string
  tipo: 'empresa' | 'dependencia_gobierno' | 'interna_itc' | 'ong'
  descripcion: string | null
  contacto_nombre: string | null
  contacto_email: string | null
  sitio_web: string | null
  activo: boolean
}

export interface PostulacionAdmin {
  id: string
  vacante_id: string
  numero_control: string
  nombre: string
  email: string
  mensaje: string
  snapshot: { porcentaje_avance?: number; promedio_ponderado?: number; semestre?: number; creditos_acumulados?: number; validado_en?: string }
  estado: EstadoPostulacion
  comentario_admin: string | null
  creado_en: string
  vacante: { id: string; titulo: string; tipo: TipoVacante; cupo: number; organizacion: { nombre: string } } | null
}

export interface AdminUser {
  id: string
  email: string
  nombre: string
  rol: 'admin' | 'revisor'
}
