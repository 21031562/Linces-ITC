import { Briefcase, Building2, CalendarClock, Check, Clock, MapPin, Search, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Empty, ErrorState, SkeletonRows, Spinner } from '../components/Feedback'
import { PageHeader, usePerfil } from '../components/Layout'
import { ApiError, api } from '../lib/api'
import { CreditTrack } from '../components/CreditTrack'
import { ESTADO_LABEL, MODALIDAD_LABEL, TIPO_LABEL, diasRestantes, fechaCorta, n1 } from '../lib/format'
import type { TipoVacante, Vacante } from '../lib/types'
import { useApi } from '../lib/useApi'

const TIPOS: (TipoVacante | 'todas')[] = ['todas', 'servicio_social', 'residencia', 'proyecto']

export default function Bolsa() {
  const [params, setParams] = useSearchParams()
  const tipo = (params.get('tipo') as TipoVacante | null) ?? null
  const [q, setQ] = useState('')
  const [soloElegibles, setSoloElegibles] = useState(false)
  const [abierta, setAbierta] = useState<Vacante | null>(null)
  const { perfil } = usePerfil()
  const { data, loading, error, reload, setData } = useApi(() => api.get<Vacante[]>(`/vacantes${tipo ? `?tipo=${tipo}` : ''}`), [tipo])

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (data ?? []).filter(
      (v) =>
        (!soloElegibles || v.elegibilidad?.elegible) &&
        (!t || [v.titulo, v.organizacion_nombre, v.area ?? '', ...v.habilidades].some((f) => f.toLowerCase().includes(t))),
    )
  }, [data, q, soloElegibles])

  const elegibles = (data ?? []).filter((v) => v.elegibilidad?.elegible).length

  return (
    <div className="page">
      <PageHeader titulo="Servicio social y residencias" icon={<Briefcase size={26} aria-hidden />}>
        Vacantes publicadas por áreas del Tec, empresas y dependencias. Linces revisa tus requisitos con tus datos del SII.
      </PageHeader>

      {perfil && (
        <section className="panel compact-track">
          <CreditTrack avance={perfil.porcentajeAvance} cursando={perfil.porcentajeAvanceCursando} />
        </section>
      )}

      <div className="toolbar">
        <div className="segmented wrap" role="tablist" aria-label="Tipo de vacante">
          {TIPOS.map((t) => {
            const on = (t === 'todas' && !tipo) || t === tipo
            return (
              <button
                key={t}
                role="tab"
                aria-selected={on}
                className={on ? 'on' : ''}
                onClick={() => setParams(t === 'todas' ? {} : { tipo: t })}
              >
                {t === 'todas' ? 'Todas' : TIPO_LABEL[t]}
              </button>
            )
          })}
        </div>
        <label className="search">
          <Search size={18} aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por puesto, organización o habilidad" aria-label="Buscar vacantes" />
        </label>
        <label className="switch">
          <input type="checkbox" checked={soloElegibles} onChange={(e) => setSoloElegibles(e.target.checked)} />
          <span>Solo en las que califico{data ? ` (${elegibles})` : ''}</span>
        </label>
      </div>

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <SkeletonRows n={5} />}
      {data && visibles.length === 0 && (
        <Empty icon={<Briefcase size={28} />} titulo={soloElegibles ? 'Todavía no calificas para estas vacantes' : 'No hay vacantes con esos filtros'}>
          {soloElegibles ? 'Desactiva el filtro para ver los requisitos que te faltan.' : 'Prueba con otro tipo o búsqueda.'}
        </Empty>
      )}

      <ul className="vacantes">
        {visibles.map((v) => (
          <li key={v.id}>
            <VacanteRow v={v} onOpen={() => setAbierta(v)} />
          </li>
        ))}
      </ul>

      {abierta && (
        <VacanteDrawer
          v={abierta}
          onClose={() => setAbierta(null)}
          onPostulada={(id) => {
            setData((prev) => prev?.map((x) => (x.id === abierta.id ? { ...x, miPostulacion: { id, estado: 'pendiente' }, postulaciones_total: x.postulaciones_total + 1 } : x)) ?? prev)
            setAbierta((a) => (a ? { ...a, miPostulacion: { id, estado: 'pendiente' } } : a))
          }}
        />
      )}
    </div>
  )
}

function Plazo({ fecha }: { fecha: string | null }) {
  const d = diasRestantes(fecha)
  if (d === null) return <span>Sin fecha límite</span>
  return <span className={d <= 7 ? 'urgente' : ''}>{d === 0 ? 'Cierra hoy' : d === 1 ? 'Cierra mañana' : `Cierra en ${d} días`}</span>
}

function VacanteRow({ v, onOpen }: { v: Vacante; onOpen: () => void }) {
  const ev = v.elegibilidad
  return (
    <article className={`vacante ${ev?.elegible ? 'elegible' : 'bloqueada'}`}>
      <div className="vacante-main">
        <span className={`tipo t-${v.tipo}`}>{TIPO_LABEL[v.tipo]}</span>
        <h3>
          <button className="linklike" onClick={onOpen}>
            {v.titulo}
          </button>
        </h3>
        <p className="vacante-org">
          <Building2 size={15} aria-hidden /> {v.organizacion_nombre}
        </p>
        <ul className="meta">
          <li>
            <MapPin size={14} aria-hidden /> {MODALIDAD_LABEL[v.modalidad]}
            {v.ubicacion ? `, ${v.ubicacion}` : ''}
          </li>
          {v.horas_semana && (
            <li>
              <Clock size={14} aria-hidden /> {v.horas_semana} h por semana
            </li>
          )}
          <li>
            <Users size={14} aria-hidden /> {v.lugares_disponibles} de {v.cupo} lugares
          </li>
          <li>
            <CalendarClock size={14} aria-hidden /> <Plazo fecha={v.fecha_limite} />
          </li>
        </ul>
      </div>
      <div className="vacante-req">
        <ul className="checks" aria-label="Requisitos">
          {ev?.checks.map((c) => (
            <li key={c.clave} className={c.cumple ? 'ok' : 'no'}>
              {c.cumple ? <Check size={14} aria-hidden /> : <X size={14} aria-hidden />}
              {c.etiqueta}: {c.clave === 'semestre' ? `${c.requerido}.º` : c.clave === 'avance' ? `${c.requerido} %` : c.requerido}
              <span className="sr-only">{c.cumple ? ' cumplido' : ' no cumplido'}</span>
            </li>
          ))}
        </ul>
        {v.miPostulacion ? (
          <span className={`estado-post p-${v.miPostulacion.estado}`}>{ESTADO_LABEL[v.miPostulacion.estado]}</span>
        ) : (
          <button className={`btn ${ev?.elegible ? 'primary' : ''}`} onClick={onOpen}>
            {ev?.elegible ? 'Postularme' : 'Ver requisitos'}
          </button>
        )}
      </div>
    </article>
  )
}

function VacanteDrawer({ v, onClose, onPostulada }: { v: Vacante; onClose: () => void; onPostulada: (id: string) => void }) {
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [err, setErr] = useState<ApiError | null>(null)
  const [ok, setOk] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function postular(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    if (mensaje.trim().length < 20) {
      setErr(new ApiError(400, 'VALIDATION', 'Cuéntales en al menos 20 caracteres por qué te interesa.'))
      return
    }
    setEnviando(true)
    try {
      const p = await api.post<{ id: string }>(`/vacantes/${v.id}/postulaciones`, { mensaje: mensaje.trim() })
      setOk(true)
      onPostulada(p.id)
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2 : new ApiError(0, 'UNKNOWN', 'No se pudo enviar.'))
    } finally {
      setEnviando(false)
    }
  }

  const ev = v.elegibilidad
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn drawer-close" onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </button>
        <span className={`tipo t-${v.tipo}`}>{TIPO_LABEL[v.tipo]}</span>
        <h2 id="drawer-title">{v.titulo}</h2>
        <p className="vacante-org">
          <Building2 size={15} aria-hidden /> {v.organizacion_nombre}
        </p>
        <p>{v.descripcion}</p>

        <dl className="facts">
          <div>
            <dt>Modalidad</dt>
            <dd>
              {MODALIDAD_LABEL[v.modalidad]}
              {v.ubicacion ? `, ${v.ubicacion}` : ''}
            </dd>
          </div>
          {v.horas_semana && (
            <div>
              <dt>Dedicación</dt>
              <dd>{v.horas_semana} horas por semana</dd>
            </div>
          )}
          <div>
            <dt>Apoyo</dt>
            <dd>{v.remunerada ? (v.apoyo_economico ?? 'Remunerada') : (v.apoyo_economico ?? 'Sin apoyo económico')}</dd>
          </div>
          <div>
            <dt>Fecha límite</dt>
            <dd>{v.fecha_limite ? fechaCorta(v.fecha_limite) : 'Abierta'}</dd>
          </div>
          <div>
            <dt>Lugares</dt>
            <dd>
              {v.lugares_disponibles} disponibles de {v.cupo}
            </dd>
          </div>
        </dl>

        {v.habilidades.length > 0 && (
          <ul className="tags" aria-label="Habilidades deseadas">
            {v.habilidades.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        )}

        <h3>Requisitos contra tu SII</h3>
        <ul className="req-table">
          {ev?.checks.map((c) => (
            <li key={c.clave} className={c.cumple ? 'ok' : 'no'}>
              {c.cumple ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}
              <span>{c.etiqueta}</span>
              <span>
                Pide {c.clave === 'avance' ? `${c.requerido} %` : c.clave === 'semestre' ? `${c.requerido}.º` : c.requerido}, tienes{' '}
                <strong>{c.clave === 'avance' ? `${n1(c.actual)} %` : c.clave === 'semestre' ? `${c.actual}.º` : n1(c.actual)}</strong>
              </span>
            </li>
          ))}
        </ul>
        {ev?.nota && <p className="notice info small">{ev.nota}</p>}

        {v.miPostulacion || ok ? (
          <div className="notice ok" role="status">
            <Check size={18} aria-hidden />
            <span>
              Postulación {ok ? 'enviada' : ESTADO_LABEL[v.miPostulacion!.estado].toLowerCase()}. Sigue su estado en <Link to="/postulaciones">Mis postulaciones</Link>.
            </span>
          </div>
        ) : ev?.elegible ? (
          <form onSubmit={postular} className="postular">
            <label className="field">
              <span>Mensaje para la organización</span>
              <textarea
                rows={5}
                maxLength={1000}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Cuéntales qué te interesa de este proyecto y qué puedes aportar."
              />
              <small className="muted">{mensaje.trim().length} de 1000 caracteres (mínimo 20)</small>
            </label>
            {err && (
              <div className="notice error" role="alert">
                {err.message}
              </div>
            )}
            <button className="btn primary block" disabled={enviando}>
              {enviando ? (
                <>
                  <Spinner size={16} /> Validando con el SII
                </>
              ) : (
                'Enviar postulación'
              )}
            </button>
          </form>
        ) : (
          <div className="notice warn">Aún no cumples todos los requisitos. Cuando tu avance en el SII cambie, el botón para postularte aparecerá aquí.</div>
        )}
      </div>
    </div>
  )
}
