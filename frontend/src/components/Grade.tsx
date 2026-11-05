import type { Semaforo } from '../lib/types'

const TEXTO: Record<Semaforo, string> = {
  verde: 'Buen desempeño',
  amarillo: 'Atención',
  rojo: 'En riesgo',
  gris: 'Sin captura',
}

/** Calificación con color de semáforo; el texto oculto evita depender solo del color */
export function Grade({ valor, semaforo, texto, size = 'md' }: { valor: number | null; semaforo: Semaforo; texto?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`grade ${semaforo} ${size}`} title={TEXTO[semaforo]}>
      {texto ?? (valor === null ? '—' : valor.toLocaleString('es-MX', { maximumFractionDigits: 1 }))}
      <span className="sr-only"> ({TEXTO[semaforo]})</span>
    </span>
  )
}

export function SemaforoLegend({ criterio }: { criterio?: { verde: string; amarillo: string; rojo: string } }) {
  return (
    <ul className="legend" aria-label="Significado de los colores">
      <li>
        <i className="dot verde" /> {criterio?.verde ?? '≥ 85'}
      </li>
      <li>
        <i className="dot amarillo" /> {criterio?.amarillo ?? '70 a 84'}
      </li>
      <li>
        <i className="dot rojo" /> {criterio?.rojo ?? '< 70'}
      </li>
    </ul>
  )
}
