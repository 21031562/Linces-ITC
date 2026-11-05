import { BookOpenCheck, ChevronDown, Printer, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Empty, ErrorState, SkeletonRows } from '../components/Feedback'
import { Grade } from '../components/Grade'
import { PageHeader, usePerfil } from '../components/Layout'
import { api } from '../lib/api'
import { n1, nombreCompleto, titulo } from '../lib/format'
import type { Kardex as K } from '../lib/types'
import { useApi } from '../lib/useApi'
import '../styles/dark-pages.css'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function Kardex() {
  const { data, loading, error, reload } = useApi(() => api.get<K>('/kardex'))
  const { perfil } = usePerfil()
  const [q, setQ] = useState('')
  const [abiertos, setAbiertos] = useState<Set<number> | 'todos'>('todos')

  const semestres = useMemo(() => {
    if (!data) return []
    const t = norm(q.trim())
    return data.semestres
      .map((s) => ({ ...s, materias: s.materias.filter((m) => !t || norm(m.nombre).includes(t) || norm(m.clave).includes(t) || m.periodo.includes(t)) }))
      .filter((s) => s.materias.length)
  }, [data, q])

  const abierto = (n: number) => abiertos === 'todos' || abiertos.has(n) || q.trim() !== ''
  const toggle = (n: number) =>
    setAbiertos((prev) => {
      const base = prev === 'todos' ? new Set(data!.semestres.map((s) => s.semestre)) : new Set(prev)
      if (base.has(n)) base.delete(n)
      else base.add(n)
      return base
    })

  return (
    <div className="page dark-page">
      <PageHeader titulo="Kardex" icon={<BookOpenCheck size={26} aria-hidden />}>
        Historial académico completo, agrupado por semestre.
      </PageHeader>

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <SkeletonRows n={8} />}

      {data && (
        <>
          <div className="print-only print-head">
            <strong>Kardex de {perfil ? nombreCompleto(perfil.nombre) : ''}</strong> No. de control {perfil?.numeroControl}. Generado desde el SII el{' '}
            {new Date().toLocaleDateString('es-MX')}.
          </div>

          <section className="summary-strip" aria-label="Resumen del kardex">
            <div>
              <span className="summary-num">{n1(data.porcentajeAvance)} %</span>
              <span>Avance</span>
            </div>
            <div>
              <span className="summary-num">{data.resumen.creditosAprobados}</span>
              <span>Créditos aprobados</span>
            </div>
            <div>
              <span className="summary-num">{n1(data.resumen.promedio)}</span>
              <span>Promedio de aprobadas</span>
            </div>
            <div>
              <span className="summary-num">{data.resumen.aprobadas}</span>
              <span>Materias aprobadas</span>
            </div>
            <div>
              <span className="summary-num">{data.resumen.noAprobadas}</span>
              <span>Sin acreditar</span>
            </div>
          </section>

          <div className="toolbar no-print">
            <label className="search">
              <Search size={18} aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar materia, clave o periodo" aria-label="Buscar en el kardex" />
              {q && (
                <button className="icon-btn" onClick={() => setQ('')} aria-label="Limpiar búsqueda">
                  <X size={16} />
                </button>
              )}
            </label>
            <button className="btn" onClick={() => setAbiertos(abiertos === 'todos' ? new Set() : 'todos')}>
              {abiertos === 'todos' ? 'Contraer todo' : 'Expandir todo'}
            </button>
            <button className="btn" onClick={() => window.print()}>
              <Printer size={16} /> Imprimir
            </button>
          </div>

          {semestres.length === 0 && (
            <Empty icon={<Search size={28} />} titulo="Sin resultados">
              Ninguna materia del kardex coincide con «{q}».
            </Empty>
          )}

          <div className="semestres">
            {semestres.map((s) => (
              <section key={s.semestre} className={`semestre ${abierto(s.semestre) ? 'open' : ''}`}>
                <button className="semestre-head" onClick={() => toggle(s.semestre)} aria-expanded={abierto(s.semestre)}>
                  <span className="semestre-n">{s.semestre}</span>
                  <span className="semestre-t">
                    <strong>{s.semestre}.º semestre</strong>
                    <small>
                      {s.materias.length} materias, {s.creditos} créditos
                    </small>
                  </span>
                  <span className="semestre-avg">
                    Promedio <strong>{n1(s.promedio)}</strong>
                  </span>
                  <ChevronDown className="chev" size={20} aria-hidden />
                </button>
                {abierto(s.semestre) && (
                  <div className="table-wrap flat">
                    <table className="table compact">
                      <thead>
                        <tr>
                          <th>Clave</th>
                          <th>Materia</th>
                          <th>Periodo</th>
                          <th className="num">Créditos</th>
                          <th>Evaluación</th>
                          <th className="num">Calificación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.materias.map((m) => (
                          <tr key={m.clave + m.periodo} className={m.aprobada ? '' : 'row-bad'}>
                            <td className="muted">{m.clave}</td>
                            <td>{titulo(m.nombre)}</td>
                            <td>{m.periodo}</td>
                            <td className="num">{m.creditos}</td>
                            <td>{titulo(m.tipoEvaluacion || '—')}</td>
                            <td className="num">
                              <Grade valor={m.calificacion} semaforo={m.semaforo} texto={m.calificacion === null ? m.calificacionTexto : undefined} size="sm" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
