import { n1 } from '../lib/format'

/**
 * La "pista de créditos": el elemento distintivo de Linces.
 * Muestra tu avance real, lo que alcanzarías si apruebas lo que cursas,
 * y dónde se desbloquean servicio social (70 %) y residencia (80 %).
 */
export function CreditTrack({ avance, cursando }: { avance: number; cursando: number }) {
  const proy = Math.max(avance, Math.min(cursando, 100))
  const hitos = [
    { pct: 70, label: 'Servicio social' },
    { pct: 80, label: 'Residencia' },
    { pct: 100, label: 'Egreso' },
  ]
  return (
    <figure className="track" aria-label={`Avance de créditos: ${n1(avance)} %`}>
      <div className="track-head">
        <div className="track-value">
          <span className="track-num">{n1(avance)}</span>
          <span className="track-pct">% de tu carrera</span>
        </div>
        {proy > avance && (
          <p className="track-proj">
            Si apruebas lo que cursas este semestre llegas a <strong>{n1(proy)} %</strong>
            {hitos.find((h) => avance < h.pct && proy >= h.pct) &&
              ` y desbloqueas ${hitos.find((h) => avance < h.pct && proy >= h.pct)!.label.toLowerCase()}`}
            .
          </p>
        )}
      </div>
      <div className="track-rail">
        <div className="track-proyeccion" style={{ width: `${proy}%` }} />
        <div className="track-fill" style={{ width: `${Math.min(avance, 100)}%` }} />
        {hitos.map((h) => (
          <div key={h.pct} className={`track-hito h-${h.pct} ${avance >= h.pct ? 'ok' : ''}`} style={{ left: `${h.pct}%` }}>
            <span className="track-tick" />
            <span className="track-hito-label">
              {h.label}
              <small>{h.pct} %</small>
            </span>
          </div>
        ))}
      </div>
      <figcaption className="track-legend">
        <span>
          <i className="sw fill" /> Créditos aprobados
        </span>
        <span>
          <i className="sw proj" /> Proyección con materias en curso
        </span>
      </figcaption>
    </figure>
  )
}
