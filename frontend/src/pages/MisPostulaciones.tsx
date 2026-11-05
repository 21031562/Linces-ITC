import { Building2, MessageSquareQuote, Send } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Empty, ErrorState, SkeletonRows } from '../components/Feedback'
import { PageHeader } from '../components/Layout'
import { ApiError, api } from '../lib/api'
import { ESTADO_LABEL, TIPO_LABEL, fechaCorta } from '../lib/format'
import type { EstadoPostulacion, MiPostulacion } from '../lib/types'
import { useApi } from '../lib/useApi'
import '../styles/dark-pages.css'

const PASOS: EstadoPostulacion[] = ['pendiente', 'en_revision', 'aceptada']

export default function MisPostulaciones() {
  const { data, loading, error, reload, setData } = useApi(() => api.get<MiPostulacion[]>('/postulaciones'))
  const [cancelando, setCancelando] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function cancelar(id: string) {
    setErr(null)
    try {
      await api.post(`/postulaciones/${id}/cancelar`)
      setData((prev) => prev?.map((p) => (p.id === id ? { ...p, estado: 'cancelada' } : p)) ?? prev)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'No se pudo cancelar.')
    } finally {
      setCancelando(null)
    }
  }

  return (
    <div className="page dark-page">
      <PageHeader titulo="Mis postulaciones" icon={<Send size={24} aria-hidden />}>
        El estado lo actualiza la coordinación de cada vacante.
      </PageHeader>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <SkeletonRows n={4} />}
      {err && (
        <div className="notice error" role="alert">
          {err}
        </div>
      )}
      {data && data.length === 0 && (
        <Empty icon={<Send size={28} />} titulo="Aún no te postulas a ninguna vacante">
          <Link to="/bolsa" className="btn primary">
            Explorar vacantes
          </Link>
        </Empty>
      )}
      <ul className="posts">
        {data?.map((p) => {
          const paso = PASOS.indexOf(p.estado)
          return (
            <li key={p.id} className={`post p-${p.estado}`}>
              <header>
                <div>
                  {p.vacante && <span className={`tipo t-${p.vacante.tipo}`}>{TIPO_LABEL[p.vacante.tipo]}</span>}
                  <h3>{p.vacante?.titulo ?? 'Vacante eliminada'}</h3>
                  <p className="vacante-org">
                    <Building2 size={15} aria-hidden /> {p.vacante?.organizacion.nombre}
                  </p>
                </div>
                <span className={`estado-post p-${p.estado}`}>{ESTADO_LABEL[p.estado]}</span>
              </header>

              {['rechazada', 'cancelada'].includes(p.estado) ? null : (
                <ol className="steps" aria-label="Progreso">
                  {PASOS.map((s, i) => (
                    <li key={s} className={i <= paso ? 'done' : ''} aria-current={i === paso ? 'step' : undefined}>
                      {ESTADO_LABEL[s]}
                    </li>
                  ))}
                </ol>
              )}

              {p.comentario_admin && (
                <blockquote className="admin-note">
                  <MessageSquareQuote size={16} aria-hidden /> {p.comentario_admin}
                </blockquote>
              )}

              <footer>
                <small className="muted">Enviada el {fechaCorta(p.creado_en)}</small>
                {['pendiente', 'en_revision'].includes(p.estado) &&
                  (cancelando === p.id ? (
                    <span className="row gap-s">
                      <span className="small">¿Cancelar esta postulación?</span>
                      <button className="btn danger sm" onClick={() => void cancelar(p.id)}>
                        Sí, cancelar
                      </button>
                      <button className="btn sm" onClick={() => setCancelando(null)}>
                        No
                      </button>
                    </span>
                  ) : (
                    <button className="btn ghost sm" onClick={() => setCancelando(p.id)}>
                      Cancelar postulación
                    </button>
                  ))}
              </footer>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
