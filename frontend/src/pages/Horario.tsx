import { CalendarDays, List, MapPin, Table2 } from 'lucide-react'
import { useState } from 'react'
import { Empty, ErrorState, Skeleton } from '../components/Feedback'
import { PageHeader } from '../components/Layout'
import { api } from '../lib/api'
import { DIA_HOY, DIA_LABEL, titulo } from '../lib/format'
import type { Dia, Horario as H } from '../lib/types'
import { useApi } from '../lib/useApi'

const SLOT = 30 // minutos por fila de la cuadrícula
const aMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export default function Horario() {
  const { data, loading, error, reload } = useApi(() => api.get<H>('/horario'))
  const [vista, setVista] = useState<'semana' | 'lista'>('semana')
  const [diaMovil, setDiaMovil] = useState<Dia>(DIA_HOY === 'domingo' ? 'lunes' : DIA_HOY)

  return (
    <div className="page">
      <PageHeader titulo="Horario" icon={<CalendarDays size={26} aria-hidden />}>
        {data?.periodo ? `${titulo(data.periodo.descripcion)}${data.plan ? `, plan ${data.plan}` : ''}` : 'Tus clases del semestre actual'}
      </PageHeader>

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <Skeleton h={480} r={14} />}

      {data && data.materias.length === 0 && (
        <Empty icon={<CalendarDays size={28} />} titulo="No tienes materias cargadas">
          Cuando el SII registre tu carga académica aparecerá aquí.
        </Empty>
      )}

      {data && data.materias.length > 0 && (
        <>
          <div className="toolbar">
            <div className="segmented" role="group" aria-label="Vista">
              <button className={vista === 'semana' ? 'on' : ''} onClick={() => setVista('semana')} aria-pressed={vista === 'semana'}>
                <Table2 size={16} /> Semana
              </button>
              <button className={vista === 'lista' ? 'on' : ''} onClick={() => setVista('lista')} aria-pressed={vista === 'lista'}>
                <List size={16} /> Por materia
              </button>
            </div>
            <div className="day-tabs" role="tablist" aria-label="Día">
              {data.dias.map((d) => (
                <button key={d} role="tab" aria-selected={diaMovil === d} className={diaMovil === d ? 'on' : ''} onClick={() => setDiaMovil(d)}>
                  {DIA_LABEL[d].slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {vista === 'semana' ? <Semana data={data} diaMovil={diaMovil} /> : <PorMateria data={data} />}
        </>
      )}
    </div>
  )
}

function Semana({ data, diaMovil }: { data: H; diaMovil: Dia }) {
  const inicio = data.horaInicio * 60
  const filas = ((data.horaFin - data.horaInicio) * 60) / SLOT
  const horas = Array.from({ length: data.horaFin - data.horaInicio }, (_, i) => data.horaInicio + i)

  return (
    <div className="week" style={{ ['--cols' as string]: data.dias.length, ['--rows' as string]: filas }}>
      <div className="week-corner" />
      {data.dias.map((d, i) => (
        <div key={d} className={`week-day ${d === DIA_HOY ? 'today' : ''} ${d === diaMovil ? 'mobile-on' : ''}`} style={{ gridColumn: i + 2 }}>
          {DIA_LABEL[d]}
          {d === DIA_HOY && <small>Hoy</small>}
        </div>
      ))}
      {horas.map((h, i) => (
        <div key={h} className="week-hour" style={{ gridRow: `${i * (60 / SLOT) + 2} / span ${60 / SLOT}` }}>
          {String(h).padStart(2, '0')}:00
        </div>
      ))}
      {data.dias.map((d, i) => (
        <div
          key={d}
          className={`week-col ${d === DIA_HOY ? 'today' : ''} ${d === diaMovil ? 'mobile-on' : ''}`}
          style={{ gridColumn: i + 2, gridRow: `2 / span ${filas}` }}
        />
      ))}
      {data.materias.flatMap((m) =>
        m.sesiones.map((s) => {
          const col = data.dias.indexOf(s.dia) + 2
          const r0 = Math.round((aMin(s.inicio) - inicio) / SLOT) + 2
          const span = Math.max(1, Math.round((aMin(s.fin) - aMin(s.inicio)) / SLOT))
          return (
            <article
              key={m.clave + s.dia + s.inicio}
              className={`week-block c${m.color} ${s.dia === diaMovil ? 'mobile-on' : ''}`}
              style={{ gridColumn: col, gridRow: `${r0} / span ${span}` }}
            >
              <strong>{titulo(m.nombre)}</strong>
              <span>
                {s.inicio}–{s.fin}
              </span>
              {s.salon && (
                <span className="salon">
                  <MapPin size={12} aria-hidden /> {s.salon}
                </span>
              )}
            </article>
          )
        }),
      )}
    </div>
  )
}

function PorMateria({ data }: { data: H }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Materia</th>
            {data.dias.map((d) => (
              <th key={d}>{DIA_LABEL[d]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.materias.map((m) => (
            <tr key={m.clave}>
              <td>
                <span className={`swatch c${m.color}`} aria-hidden />
                <strong>{titulo(m.nombre)}</strong>
                <small className="muted block">
                  {m.clave}, grupo {m.grupo}
                </small>
              </td>
              {data.dias.map((d) => {
                const s = m.sesiones.find((x) => x.dia === d)
                return (
                  <td key={d}>
                    {s ? (
                      <>
                        {s.inicio}–{s.fin}
                        {s.salon && <small className="muted block">{s.salon}</small>}
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
