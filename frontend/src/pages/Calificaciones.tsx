import { ClipboardList, LayoutGrid, Rows3, Search, TriangleAlert, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Empty, ErrorState, SkeletonRows } from '../components/Feedback'
import { Grade, SemaforoLegend } from '../components/Grade'
import { PageHeader } from '../components/Layout'
import { api } from '../lib/api'
import { n1, titulo } from '../lib/format'
import type { Calificaciones as Cal, MateriaCalificacion, Semaforo } from '../lib/types'
import { useApi } from '../lib/useApi'
import '../styles/dark-pages.css'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const ESTADO: Record<MateriaCalificacion['estado'], string> = {
  aprobando: 'Aprobando',
  en_riesgo: 'Unidad reprobada',
  reprobando: 'Reprobando',
  sin_captura: 'Sin calificaciones',
}

export default function Calificaciones() {
  const { data, loading, error, reload } = useApi(() => api.get<Cal>('/calificaciones'))
  const [q, setQ] = useState('')
  const [periodo, setPeriodo] = useState('todos')
  const [color, setColor] = useState<Semaforo | 'todos'>('todos')
  const [vista, setVista] = useState<'tabla' | 'tarjetas'>('tabla')

  // Filtrado en tiempo real por nombre/clave de materia o por periodo
  const filtradas = useMemo(() => {
    if (!data) return []
    const t = norm(q.trim())
    return data.materias.filter(
      (m) =>
        (periodo === 'todos' || m.periodo.clave === periodo) &&
        (color === 'todos' || m.semaforo === color) &&
        (!t || [m.nombre, m.clave, m.periodo.descripcion, m.periodo.clave].some((f) => norm(f).includes(t))),
    )
  }, [data, q, periodo, color])

  return (
    <div className="page dark-page">
      <PageHeader titulo="Calificaciones" icon={<ClipboardList size={26} aria-hidden />}>
        {data?.periodos.length ? `Periodo ${data.periodos.map((p) => titulo(p.descripcion)).join(', ')}` : 'Tus calificaciones por unidad del periodo actual'}
      </PageHeader>

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <SkeletonRows n={7} />}

      {data && (
        <>
          <section className="summary-strip" aria-label="Resumen">
            <div>
              <span className="summary-num">{n1(data.resumen.promedio)}</span>
              <span>Promedio actual</span>
            </div>
            <div>
              <span className="summary-num">{data.resumen.materias}</span>
              <span>Materias</span>
            </div>
            <button className={`chip verde ${color === 'verde' ? 'on' : ''}`} onClick={() => setColor(color === 'verde' ? 'todos' : 'verde')} aria-pressed={color === 'verde'}>
              {data.resumen.verdes} con buen desempeño
            </button>
            <button className={`chip amarillo ${color === 'amarillo' ? 'on' : ''}`} onClick={() => setColor(color === 'amarillo' ? 'todos' : 'amarillo')} aria-pressed={color === 'amarillo'}>
              {data.resumen.amarillas} requieren atención
            </button>
            <button className={`chip rojo ${color === 'rojo' ? 'on' : ''}`} onClick={() => setColor(color === 'rojo' ? 'todos' : 'rojo')} aria-pressed={color === 'rojo'}>
              {data.resumen.rojas} en riesgo
            </button>
          </section>

          <div className="toolbar">
            <label className="search">
              <Search size={18} aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por materia, clave o periodo" aria-label="Buscar materia o periodo" />
              {q && (
                <button className="icon-btn" onClick={() => setQ('')} aria-label="Limpiar búsqueda">
                  <X size={16} />
                </button>
              )}
            </label>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Filtrar por periodo">
              <option value="todos">Todos los periodos</option>
              {data.periodos.map((p) => (
                <option key={p.clave} value={p.clave}>
                  {titulo(p.descripcion)}
                </option>
              ))}
            </select>
            <div className="segmented" role="group" aria-label="Vista">
              <button className={vista === 'tabla' ? 'on' : ''} onClick={() => setVista('tabla')} aria-pressed={vista === 'tabla'}>
                <Rows3 size={16} /> Tabla
              </button>
              <button className={vista === 'tarjetas' ? 'on' : ''} onClick={() => setVista('tarjetas')} aria-pressed={vista === 'tarjetas'}>
                <LayoutGrid size={16} /> Tarjetas
              </button>
            </div>
          </div>

          {filtradas.length === 0 ? (
            <Empty icon={<Search size={28} />} titulo="Ninguna materia coincide">
              Prueba con otro nombre o quita los filtros.
            </Empty>
          ) : vista === 'tabla' ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Materia</th>
                    <th>Periodo</th>
                    <th>Unidades</th>
                    <th className="num">Calificación final</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((m) => (
                    <tr key={m.periodo.clave + m.clave}>
                      <td>
                        <strong>{titulo(m.nombre)}</strong>
                        <small className="muted block">
                          {m.clave}, grupo {m.grupo}
                        </small>
                      </td>
                      <td>{titulo(m.periodo.descripcion)}</td>
                      <td>
                        <Parciales m={m} />
                      </td>
                      <td className="num">
                        <Grade valor={m.final} semaforo={m.semaforo} />
                      </td>
                      <td>
                        <Estado m={m} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="cards-grid">
              {filtradas.map((m) => (
                <article key={m.periodo.clave + m.clave} className={`grade-card s-${m.semaforo}`}>
                  <header>
                    <h3>{titulo(m.nombre)}</h3>
                    <Grade valor={m.final} semaforo={m.semaforo} size="lg" />
                  </header>
                  <p className="muted small">
                    {m.clave}, grupo {m.grupo}. {titulo(m.periodo.descripcion)}
                  </p>
                  <Parciales m={m} />
                  <Estado m={m} />
                </article>
              ))}
            </div>
          )}

          <footer className="criteria">
            <SemaforoLegend criterio={data.criterio} />
            <p className="muted small">La calificación final es el {data.criterio.final.toLowerCase()}. La mínima aprobatoria es 70.</p>
          </footer>
        </>
      )}
    </div>
  )
}

function Parciales({ m }: { m: MateriaCalificacion }) {
  if (!m.parciales.length) return <span className="muted">—</span>
  return (
    <ol className="units" aria-label="Calificaciones por unidad">
      {m.parciales.map((p) => (
        <li key={p.unidad} className={p.valor === null ? 'none' : p.valor < 70 ? 'bad' : ''} title={`Unidad ${p.unidad}`}>
          <small>U{p.unidad}</small>
          {p.valor ?? '—'}
        </li>
      ))}
    </ol>
  )
}

function Estado({ m }: { m: MateriaCalificacion }) {
  return (
    <span className={`estado e-${m.estado}`}>
      {m.estado === 'en_riesgo' && <TriangleAlert size={14} aria-hidden />}
      {ESTADO[m.estado]}
      {m.unidadesReprobadas > 0 && m.estado !== 'reprobando' && ` (${m.unidadesReprobadas})`}
    </span>
  )
}
