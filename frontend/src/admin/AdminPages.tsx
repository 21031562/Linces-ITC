import { Building2, FileClock, Inbox, LayoutDashboard, ListChecks, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Empty, ErrorState, SkeletonRows, Spinner } from '../components/Feedback'
import { PageHeader } from '../components/Layout'
import { ApiError, adminApi } from '../lib/api'
import { ESTADO_LABEL, MODALIDAD_LABEL, ORG_TIPO_LABEL, TIPO_LABEL, fechaCorta, n1, nombreCompleto } from '../lib/format'
import type { EstadoPostulacion, Organizacion, PostulacionAdmin, TipoVacante, Vacante } from '../lib/types'
import { useApi } from '../lib/useApi'
import { useAdmin } from './AdminAuth'

function useAdminError() {
  const { logout } = useAdmin()
  return (code: string) => void logout(code)
}

// ── Modal genérico ──────────────────────────────────────────────────────────
function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>{titulo}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

// ── Resumen ─────────────────────────────────────────────────────────────────
interface Stats {
  vacantesPorEstado: Record<string, number>
  vacantesPorTipo: Record<string, number>
  postulacionesPorEstado: Record<string, number>
  totalPostulaciones: number
  lugaresOcupados: number
  lugaresTotales: number
  topVacantes: { id: string; titulo: string; postulaciones: number }[]
  ultimos14Dias: { fecha: string; total: number }[]
}

export function AdminDashboard() {
  const onAuthLost = useAdminError()
  const { data, loading, error, reload } = useApi(() => adminApi.get<Stats>('/estadisticas'))
  return (
    <div className="page">
      <PageHeader titulo="Resumen de la bolsa" icon={<LayoutDashboard size={24} aria-hidden />}>
        Actividad de vacantes y postulaciones.
      </PageHeader>
      {error && <ErrorState error={error} onRetry={reload} onAuthLost={onAuthLost} />}
      {loading && <SkeletonRows n={4} />}
      {data && (
        <>
          <section className="stats">
            <div className="stat tone-azul">
              <ListChecks size={20} aria-hidden />
              <span className="stat-value">{data.vacantesPorEstado.publicada ?? 0}</span>
              <span className="stat-label">Vacantes publicadas</span>
            </div>
            <div className="stat tone-amarillo">
              <Inbox size={20} aria-hidden />
              <span className="stat-value">{(data.postulacionesPorEstado.pendiente ?? 0) + (data.postulacionesPorEstado.en_revision ?? 0)}</span>
              <span className="stat-label">Postulaciones por revisar</span>
            </div>
            <div className="stat tone-verde">
              <Building2 size={20} aria-hidden />
              <span className="stat-value">
                {data.lugaresOcupados} de {data.lugaresTotales}
              </span>
              <span className="stat-label">Lugares asignados</span>
            </div>
            <div className="stat tone-azul">
              <FileClock size={20} aria-hidden />
              <span className="stat-value">{data.totalPostulaciones}</span>
              <span className="stat-label">Postulaciones totales</span>
            </div>
          </section>
          <div className="dash-grid">
            <section className="panel">
              <h2 className="panel-title">Postulaciones de los últimos 14 días</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.ultimos14Dias.map((d) => ({ ...d, dia: d.fecha.slice(8) + '/' + d.fecha.slice(5, 7) }))} margin={{ left: -24, right: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--ink-2)' }} interval={1} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--ink-2)' }} />
                  <Tooltip formatter={(v) => [v, 'Postulaciones']} contentStyle={{ borderRadius: 10, border: '1px solid var(--line)' }} />
                  <Bar dataKey="total" fill="var(--pri)" radius={[5, 5, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </section>
            <section className="panel">
              <h2 className="panel-title">Vacantes con más interés</h2>
              <ol className="rank">
                {data.topVacantes.map((v) => (
                  <li key={v.id}>
                    <Link to={`/admin/postulaciones?vacante_id=${v.id}`}>{v.titulo}</Link>
                    <span>{v.postulaciones}</span>
                  </li>
                ))}
              </ol>
              <h2 className="panel-title">Postulaciones por estado</h2>
              <ul className="kv">
                {(['pendiente', 'en_revision', 'aceptada', 'rechazada', 'cancelada'] as EstadoPostulacion[]).map((e) => (
                  <li key={e}>
                    <span className={`estado-post p-${e}`}>{ESTADO_LABEL[e]}</span>
                    <strong>{data.postulacionesPorEstado[e] ?? 0}</strong>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  )
}

// ── Vacantes ────────────────────────────────────────────────────────────────
type VacanteForm = Omit<Vacante, 'id' | 'organizacion_nombre' | 'organizacion_tipo' | 'postulaciones_total' | 'lugares_disponibles' | 'elegibilidad' | 'miPostulacion' | 'aceptadas'> & {
  organizacion_id: string
}

const VACIA: VacanteForm = {
  organizacion_id: '',
  titulo: '',
  tipo: 'servicio_social',
  descripcion: '',
  area: '',
  modalidad: 'presencial',
  ubicacion: '',
  cupo: 1,
  horas_semana: 20,
  remunerada: false,
  apoyo_economico: '',
  requisito_avance_min: 70,
  requisito_promedio_min: 0,
  requisito_semestre_min: 1,
  habilidades: [],
  fecha_limite: null,
  estado: 'borrador',
}

export function AdminVacantes() {
  const { admin } = useAdmin()
  const onAuthLost = useAdminError()
  const [estado, setEstado] = useState('')
  const { data, loading, error, reload } = useApi(() => adminApi.get<Vacante[]>(`/vacantes${estado ? `?estado=${estado}` : ''}`), [estado])
  const orgs = useApi(() => adminApi.get<Organizacion[]>('/organizaciones'))
  const [editando, setEditando] = useState<(VacanteForm & { id?: string }) | null>(null)
  const [borrar, setBorrar] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const puede = admin?.rol === 'admin'

  async function cambiarEstado(v: Vacante, nuevo: Vacante['estado']) {
    try {
      await adminApi.patch(`/vacantes/${v.id}`, { estado: nuevo })
      setMsg(nuevo === 'publicada' ? 'Vacante publicada.' : nuevo === 'cerrada' ? 'Vacante cerrada.' : 'Vacante movida a borrador.')
      reload()
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'No se pudo actualizar.')
    }
  }
  async function eliminar(id: string) {
    try {
      await adminApi.del(`/vacantes/${id}`)
      setMsg('Vacante eliminada.')
      reload()
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'No se pudo eliminar.')
    } finally {
      setBorrar(null)
    }
  }

  return (
    <div className="page">
      <PageHeader titulo="Vacantes" icon={<ListChecks size={24} aria-hidden />}>
        Publica, edita y cierra vacantes. Los alumnos solo ven las publicadas y vigentes.
      </PageHeader>
      <div className="toolbar">
        <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="publicada">Publicada</option>
          <option value="cerrada">Cerrada</option>
        </select>
        {puede && (
          <button className="btn primary" onClick={() => setEditando({ ...VACIA })}>
            <Plus size={16} /> Nueva vacante
          </button>
        )}
      </div>
      {msg && (
        <div className="notice info" role="status">
          {msg}
        </div>
      )}
      {error && <ErrorState error={error} onRetry={reload} onAuthLost={onAuthLost} />}
      {loading && <SkeletonRows n={5} />}
      {data && data.length === 0 && <Empty icon={<ListChecks size={28} />} titulo="No hay vacantes con ese estado" />}
      {data && data.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Vacante</th>
                <th>Tipo</th>
                <th>Requisitos</th>
                <th className="num">Cupo</th>
                <th>Cierre</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((v) => (
                <tr key={v.id}>
                  <td>
                    <strong>{v.titulo}</strong>
                    <small className="muted block">{v.organizacion_nombre}</small>
                  </td>
                  <td>
                    <span className={`tipo t-${v.tipo}`}>{TIPO_LABEL[v.tipo]}</span>
                  </td>
                  <td className="small">
                    {v.requisito_avance_min} % avance, prom. {v.requisito_promedio_min}, {v.requisito_semestre_min}.º sem.
                  </td>
                  <td className="num">
                    <Link to={`/admin/postulaciones?vacante_id=${v.id}`}>
                      {v.aceptadas}/{v.cupo}
                    </Link>
                    <small className="muted block">{v.postulaciones_total} postul.</small>
                  </td>
                  <td>{v.fecha_limite ? fechaCorta(v.fecha_limite) : '—'}</td>
                  <td>
                    {puede ? (
                      <select className={`estado-select v-${v.estado}`} value={v.estado} onChange={(e) => void cambiarEstado(v, e.target.value as Vacante['estado'])} aria-label="Estado">
                        <option value="borrador">Borrador</option>
                        <option value="publicada">Publicada</option>
                        <option value="cerrada">Cerrada</option>
                      </select>
                    ) : (
                      v.estado
                    )}
                  </td>
                  <td className="actions">
                    {puede &&
                      (borrar === v.id ? (
                        <>
                          <button className="btn danger sm" onClick={() => void eliminar(v.id)}>
                            Eliminar
                          </button>
                          <button className="btn sm" onClick={() => setBorrar(null)}>
                            No
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="icon-btn" aria-label="Editar" onClick={() => setEditando({ ...v, organizacion_id: v.organizacion_id ?? '' })}>
                            <Pencil size={16} />
                          </button>
                          <button className="icon-btn" aria-label="Eliminar" onClick={() => setBorrar(v.id)}>
                            <Trash2 size={16} />
                          </button>
                        </>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editando && (
        <VacanteFormModal
          inicial={editando}
          orgs={orgs.data ?? []}
          onClose={() => setEditando(null)}
          onSaved={() => {
            setEditando(null)
            setMsg(editando.id ? 'Cambios guardados.' : 'Vacante creada.')
            reload()
          }}
        />
      )}
    </div>
  )
}

function VacanteFormModal({ inicial, orgs, onClose, onSaved }: { inicial: VacanteForm & { id?: string }; orgs: Organizacion[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(inicial)
  const [habilidades, setHabilidades] = useState(inicial.habilidades.join(', '))
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof VacanteForm>(k: K, v: VacanteForm[K]) => setF((p) => ({ ...p, [k]: v }))

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setSaving(true)
    const body = {
      organizacion_id: f.organizacion_id,
      titulo: f.titulo,
      tipo: f.tipo,
      descripcion: f.descripcion,
      area: f.area || null,
      modalidad: f.modalidad,
      ubicacion: f.ubicacion || null,
      cupo: Number(f.cupo),
      horas_semana: f.horas_semana ? Number(f.horas_semana) : null,
      remunerada: f.remunerada,
      apoyo_economico: f.apoyo_economico || null,
      requisito_avance_min: Number(f.requisito_avance_min),
      requisito_promedio_min: Number(f.requisito_promedio_min),
      requisito_semestre_min: Number(f.requisito_semestre_min),
      habilidades: habilidades.split(',').map((h) => h.trim()).filter(Boolean),
      fecha_limite: f.fecha_limite || null,
      estado: f.estado,
    }
    try {
      if (inicial.id) await adminApi.patch(`/vacantes/${inicial.id}`, body)
      else await adminApi.post('/vacantes', body)
      onSaved()
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  const minInst = f.tipo === 'servicio_social' ? 70 : f.tipo === 'residencia' ? 80 : 0
  return (
    <Modal titulo={inicial.id ? 'Editar vacante' : 'Nueva vacante'} onClose={onClose}>
      <form className="form-grid" onSubmit={guardar}>
        <label className="field span-2">
          <span>Título</span>
          <input required value={f.titulo} onChange={(e) => set('titulo', e.target.value)} />
        </label>
        <label className="field">
          <span>Organización</span>
          <select required value={f.organizacion_id} onChange={(e) => set('organizacion_id', e.target.value)}>
            <option value="">Selecciona…</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tipo</span>
          <select value={f.tipo} onChange={(e) => set('tipo', e.target.value as TipoVacante)}>
            {Object.entries(TIPO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field span-2">
          <span>Descripción</span>
          <textarea required rows={4} value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} />
        </label>
        <label className="field">
          <span>Área</span>
          <input value={f.area ?? ''} onChange={(e) => set('area', e.target.value)} />
        </label>
        <label className="field">
          <span>Modalidad</span>
          <select value={f.modalidad} onChange={(e) => set('modalidad', e.target.value as VacanteForm['modalidad'])}>
            {Object.entries(MODALIDAD_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Ubicación</span>
          <input value={f.ubicacion ?? ''} onChange={(e) => set('ubicacion', e.target.value)} />
        </label>
        <label className="field">
          <span>Fecha límite</span>
          <input type="date" value={f.fecha_limite ?? ''} onChange={(e) => set('fecha_limite', e.target.value || null)} />
        </label>
        <label className="field">
          <span>Cupo</span>
          <input type="number" min={1} value={f.cupo} onChange={(e) => set('cupo', Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Horas por semana</span>
          <input type="number" min={1} max={48} value={f.horas_semana ?? ''} onChange={(e) => set('horas_semana', e.target.value ? Number(e.target.value) : null)} />
        </label>
        <fieldset className="span-2 req-fields">
          <legend>Requisitos (se validan contra el SII del alumno)</legend>
          <label className="field">
            <span>Avance mínimo (%)</span>
            <input type="number" min={0} max={100} value={f.requisito_avance_min} onChange={(e) => set('requisito_avance_min', Number(e.target.value))} />
            {minInst > 0 && <small className="muted">El mínimo institucional para {TIPO_LABEL[f.tipo].toLowerCase()} es {minInst} % y siempre se aplica.</small>}
          </label>
          <label className="field">
            <span>Promedio mínimo</span>
            <input type="number" min={0} max={100} value={f.requisito_promedio_min} onChange={(e) => set('requisito_promedio_min', Number(e.target.value))} />
          </label>
          <label className="field">
            <span>Semestre mínimo</span>
            <input type="number" min={1} max={14} value={f.requisito_semestre_min} onChange={(e) => set('requisito_semestre_min', Number(e.target.value))} />
          </label>
        </fieldset>
        <label className="field span-2">
          <span>Habilidades (separadas por coma)</span>
          <input value={habilidades} onChange={(e) => setHabilidades(e.target.value)} placeholder="React, SQL, Trabajo en equipo" />
        </label>
        <label className="field">
          <span>Apoyo económico</span>
          <input value={f.apoyo_economico ?? ''} onChange={(e) => set('apoyo_economico', e.target.value)} />
        </label>
        <label className="switch field-switch">
          <input type="checkbox" checked={f.remunerada} onChange={(e) => set('remunerada', e.target.checked)} />
          <span>Es remunerada</span>
        </label>
        <label className="field">
          <span>Estado</span>
          <select value={f.estado} onChange={(e) => set('estado', e.target.value as Vacante['estado'])}>
            <option value="borrador">Borrador</option>
            <option value="publicada">Publicada</option>
            <option value="cerrada">Cerrada</option>
          </select>
        </label>
        {err && (
          <div className="notice error span-2" role="alert">
            {err}
          </div>
        )}
        <div className="span-2 row end gap-s">
          <button type="button" className="btn" onClick={onClose}>
            Descartar
          </button>
          <button className="btn primary" disabled={saving}>
            {saving ? <Spinner size={16} /> : inicial.id ? 'Guardar cambios' : 'Crear vacante'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Postulaciones ───────────────────────────────────────────────────────────
export function AdminPostulaciones() {
  const onAuthLost = useAdminError()
  const [params, setParams] = useSearchParams()
  const vacanteId = params.get('vacante_id') ?? ''
  const estado = params.get('estado') ?? ''
  const qs = new URLSearchParams({ ...(vacanteId && { vacante_id: vacanteId }), ...(estado && { estado }) }).toString()
  const { data, loading, error, reload, setData } = useApi(() => adminApi.get<PostulacionAdmin[]>(`/postulaciones${qs ? `?${qs}` : ''}`), [qs])
  const vacantes = useApi(() => adminApi.get<Vacante[]>('/vacantes'))
  const [abierta, setAbierta] = useState<string | null>(null)

  const setFiltro = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v)
    else p.delete(k)
    setParams(p)
  }

  return (
    <div className="page">
      <PageHeader titulo="Postulaciones" icon={<Inbox size={24} aria-hidden />}>
        Revisa a los candidatos. Los indicadores académicos se tomaron del SII al momento de postular.
      </PageHeader>
      <div className="toolbar">
        <select value={vacanteId} onChange={(e) => setFiltro('vacante_id', e.target.value)} aria-label="Filtrar por vacante">
          <option value="">Todas las vacantes</option>
          {vacantes.data?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.titulo}
            </option>
          ))}
        </select>
        <select value={estado} onChange={(e) => setFiltro('estado', e.target.value)} aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {error && <ErrorState error={error} onRetry={reload} onAuthLost={onAuthLost} />}
      {loading && <SkeletonRows n={5} />}
      {data && data.length === 0 && <Empty icon={<Inbox size={28} />} titulo="Sin postulaciones con esos filtros" />}
      <ul className="posts">
        {data?.map((p) => (
          <PostulacionItem
            key={p.id}
            p={p}
            open={abierta === p.id}
            onToggle={() => setAbierta(abierta === p.id ? null : p.id)}
            onUpdated={(np) => setData((prev) => prev?.map((x) => (x.id === np.id ? { ...x, ...np } : x)) ?? prev)}
          />
        ))}
      </ul>
    </div>
  )
}

function PostulacionItem({ p, open, onToggle, onUpdated }: { p: PostulacionAdmin; open: boolean; onToggle: () => void; onUpdated: (p: Partial<PostulacionAdmin> & { id: string }) => void }) {
  const [comentario, setComentario] = useState(p.comentario_admin ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  async function cambiar(estado: EstadoPostulacion) {
    setErr(null)
    setSaving(estado)
    try {
      const r = await adminApi.patch<PostulacionAdmin>(`/postulaciones/${p.id}`, { estado, comentario_admin: comentario || null })
      onUpdated({ id: p.id, estado: r.estado, comentario_admin: r.comentario_admin })
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'No se pudo actualizar.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <li className={`post p-${p.estado}`}>
      <header>
        <div>
          <h3>{nombreCompleto(p.nombre)}</h3>
          <p className="muted small">
            {p.numero_control}, {p.email}
          </p>
          <p className="small">
            {p.vacante?.titulo} <span className="muted">({p.vacante?.organizacion.nombre})</span>
          </p>
        </div>
        <div className="post-side">
          <span className={`estado-post p-${p.estado}`}>{ESTADO_LABEL[p.estado]}</span>
          <button className="btn sm" onClick={onToggle} aria-expanded={open}>
            {open ? 'Ocultar' : 'Revisar'}
          </button>
        </div>
      </header>
      {open && (
        <div className="post-detail">
          <dl className="facts">
            <div>
              <dt>Avance</dt>
              <dd>{n1(p.snapshot.porcentaje_avance)} %</dd>
            </div>
            <div>
              <dt>Promedio</dt>
              <dd>{n1(p.snapshot.promedio_ponderado, 2)}</dd>
            </div>
            <div>
              <dt>Semestre</dt>
              <dd>{p.snapshot.semestre}.º</dd>
            </div>
            <div>
              <dt>Enviada</dt>
              <dd>{fechaCorta(p.creado_en)}</dd>
            </div>
          </dl>
          <blockquote className="admin-note">{p.mensaje}</blockquote>
          {p.estado !== 'cancelada' && (
            <>
              <label className="field">
                <span>Comentario para el alumno (opcional)</span>
                <textarea rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Ej. Preséntate el lunes a las 9:00 con tu INE." />
              </label>
              {err && <div className="notice error">{err}</div>}
              <div className="row gap-s wrap">
                <button className="btn" disabled={!!saving} onClick={() => void cambiar('en_revision')}>
                  {saving === 'en_revision' ? <Spinner size={14} /> : 'Marcar en revisión'}
                </button>
                <button className="btn success" disabled={!!saving} onClick={() => void cambiar('aceptada')}>
                  {saving === 'aceptada' ? <Spinner size={14} /> : 'Aceptar'}
                </button>
                <button className="btn danger" disabled={!!saving} onClick={() => void cambiar('rechazada')}>
                  {saving === 'rechazada' ? <Spinner size={14} /> : 'Rechazar'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  )
}

// ── Organizaciones ──────────────────────────────────────────────────────────
const ORG_VACIA: Omit<Organizacion, 'id'> = { nombre: '', tipo: 'empresa', descripcion: '', contacto_nombre: '', contacto_email: '', sitio_web: '', activo: true }

export function AdminOrganizaciones() {
  const { admin } = useAdmin()
  const onAuthLost = useAdminError()
  const { data, loading, error, reload } = useApi(() => adminApi.get<Organizacion[]>('/organizaciones'))
  const [editando, setEditando] = useState<(Omit<Organizacion, 'id'> & { id?: string }) | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!editando) return
    setErr(null)
    const { id, ...body } = editando
    try {
      if (id) await adminApi.patch(`/organizaciones/${id}`, body)
      else await adminApi.post('/organizaciones', body)
      setEditando(null)
      setMsg(id ? 'Organización actualizada.' : 'Organización creada.')
      reload()
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'No se pudo guardar.')
    }
  }
  async function eliminar(id: string) {
    try {
      await adminApi.del(`/organizaciones/${id}`)
      setMsg('Organización eliminada.')
      reload()
    } catch (e2) {
      setMsg(e2 instanceof ApiError ? e2.message : 'No se pudo eliminar.')
    }
  }

  return (
    <div className="page">
      <PageHeader titulo="Organizaciones" icon={<Building2 size={24} aria-hidden />}>
        Empresas, dependencias y áreas del Tec que publican vacantes.
      </PageHeader>
      {admin?.rol === 'admin' && (
        <div className="toolbar">
          <button className="btn primary" onClick={() => setEditando({ ...ORG_VACIA })}>
            <Plus size={16} /> Nueva organización
          </button>
        </div>
      )}
      {msg && <div className="notice info">{msg}</div>}
      {error && <ErrorState error={error} onRetry={reload} onAuthLost={onAuthLost} />}
      {loading && <SkeletonRows n={4} />}
      {data && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Contacto</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.nombre}</strong>
                    {o.descripcion && <small className="muted block">{o.descripcion}</small>}
                  </td>
                  <td>{ORG_TIPO_LABEL[o.tipo]}</td>
                  <td className="small">
                    {o.contacto_nombre}
                    {o.contacto_email && <small className="muted block">{o.contacto_email}</small>}
                  </td>
                  <td>{o.activo ? 'Activa' : 'Inactiva'}</td>
                  <td className="actions">
                    {admin?.rol === 'admin' && (
                      <>
                        <button className="icon-btn" aria-label="Editar" onClick={() => setEditando(o)}>
                          <Pencil size={16} />
                        </button>
                        <button className="icon-btn" aria-label="Eliminar" onClick={() => void eliminar(o.id)}>
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editando && (
        <Modal titulo={editando.id ? 'Editar organización' : 'Nueva organización'} onClose={() => setEditando(null)}>
          <form className="form-grid" onSubmit={guardar}>
            <label className="field span-2">
              <span>Nombre</span>
              <input required value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} />
            </label>
            <label className="field">
              <span>Tipo</span>
              <select value={editando.tipo} onChange={(e) => setEditando({ ...editando, tipo: e.target.value as Organizacion['tipo'] })}>
                {Object.entries(ORG_TIPO_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="switch field-switch">
              <input type="checkbox" checked={editando.activo} onChange={(e) => setEditando({ ...editando, activo: e.target.checked })} />
              <span>Activa</span>
            </label>
            <label className="field span-2">
              <span>Descripción</span>
              <textarea rows={3} value={editando.descripcion ?? ''} onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })} />
            </label>
            <label className="field">
              <span>Persona de contacto</span>
              <input value={editando.contacto_nombre ?? ''} onChange={(e) => setEditando({ ...editando, contacto_nombre: e.target.value })} />
            </label>
            <label className="field">
              <span>Correo de contacto</span>
              <input type="email" value={editando.contacto_email ?? ''} onChange={(e) => setEditando({ ...editando, contacto_email: e.target.value })} />
            </label>
            <label className="field span-2">
              <span>Sitio web</span>
              <input type="url" value={editando.sitio_web ?? ''} onChange={(e) => setEditando({ ...editando, sitio_web: e.target.value })} placeholder="https://" />
            </label>
            {err && <div className="notice error span-2">{err}</div>}
            <div className="span-2 row end gap-s">
              <button type="button" className="btn" onClick={() => setEditando(null)}>
                Descartar
              </button>
              <button className="btn primary">{editando.id ? 'Guardar cambios' : 'Crear organización'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ── Bitácora ────────────────────────────────────────────────────────────────
interface Bit {
  id: number
  accion: string
  entidad: string
  entidad_id: string | null
  creado_en: string
  admin: { nombre: string; email: string } | null
}
export function AdminBitacora() {
  const onAuthLost = useAdminError()
  const { data, loading, error, reload } = useApi(() => adminApi.get<Bit[]>('/bitacora'))
  const filas = useMemo(() => data ?? [], [data])
  return (
    <div className="page">
      <PageHeader titulo="Bitácora" icon={<FileClock size={24} aria-hidden />}>
        Últimas 100 acciones del panel de administración.
      </PageHeader>
      {error && <ErrorState error={error} onRetry={reload} onAuthLost={onAuthLost} />}
      {loading && <SkeletonRows n={6} />}
      {data && (
        <div className="table-wrap">
          <table className="table compact">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Quién</th>
                <th>Acción</th>
                <th>Sobre</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((b) => (
                <tr key={b.id}>
                  <td>{new Date(b.creado_en).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>{b.admin?.nombre ?? 'Sistema'}</td>
                  <td>{b.accion.replace('estado:', 'Cambió a ')}</td>
                  <td>
                    {b.entidad} <small className="muted">{b.entidad_id?.slice(0, 8)}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
