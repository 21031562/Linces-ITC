import { Award, BookOpen, CircleAlert, Clock, GraduationCap, MapPin, TrendingUp } from 'lucide-react'
import type { ComponentType } from 'react'
import { Link } from 'react-router'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ErrorState, Skeleton } from '../components/Feedback'
import { Avatar, usePerfil } from '../components/Layout'
import { api } from '../lib/api'
import { DIA_HOY, DIA_LABEL, n1, nombreCompleto, nombrePila, titulo } from '../lib/format'
import type { Horario, Kardex } from '../lib/types'
import { useApi } from '../lib/useApi'
import '../styles/dashboard.css'

function saludo() {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

export default function Dashboard() {
  const { perfil, loading, error, reload } = usePerfil()

  if (error)
    return (
      <div className="page">
        <ErrorState error={error} onRetry={reload} />
      </div>
    )
  if (loading || !perfil) return <DashboardSkeleton />

  const p = perfil
  return (
    <div className="page dash-page">
      <div className="board">
        <section className="board-main">
          <header className="board-head">
            <div>
              <p className="board-kicker">
                {saludo()}, {nombrePila(p.nombre)}
              </p>
              <h1>Resumen académico</h1>
            </div>
          </header>

          <div className="kpis" aria-label="Indicadores principales">
            <Kpi icon={Award} value={n1(p.promedioPonderado, 2)} label="Promedio ponderado" />
            <Kpi icon={GraduationCap} value={`${n1(p.porcentajeAvance, 1)}%`} label="Avance de la carrera" destacado />
            <Kpi
              icon={CircleAlert}
              value={String(p.materiasReprobadas).padStart(2, '0')}
              label="Materias reprobadas"
              tono={p.materiasReprobadas > 0 ? 'coral' : 'ok'}
            />
          </div>

          <PromedioChart />

          <div className="gauges">
            <section className="board-card">
              <header className="card-head">
                <h2>Metas de créditos</h2>
                <span className="chip-dark">
                  {p.creditosAcumulados} créditos
                </span>
              </header>
              <div className="rings">
                <Ring etiqueta="Servicio social" meta={70} actual={p.porcentajeAvance} proyeccion={p.porcentajeAvanceCursando} />
                <Ring etiqueta="Residencia" meta={80} actual={p.porcentajeAvance} proyeccion={p.porcentajeAvanceCursando} />
                <Ring etiqueta="Egreso" meta={100} actual={p.porcentajeAvance} proyeccion={p.porcentajeAvanceCursando} />
              </div>
              <ul className="ring-legend">
                <li>
                  <i className="lg-dot actual" /> Aprobado
                </li>
                <li>
                  <i className="lg-dot proy" /> Si apruebas lo que cursas
                </li>
              </ul>
            </section>

            <section className="board-card">
              <header className="card-head">
                <h2>Créditos complementarios</h2>
              </header>
              <SemiGauge valor={p.creditosComplementarios} max={5} />
              <ul className="ring-legend">
                <li>
                  <i className="lg-dot actual" /> Acreditados
                </li>
                <li>
                  <i className="lg-dot vacio" /> Pendientes
                </li>
              </ul>
            </section>
          </div>
        </section>

        <aside className="board-side" aria-label="Tu perfil">
          <div className="side-id">
            <Avatar perfil={p} size={52} />
            <div>
              <strong>{nombreCompleto(p.nombre)}</strong>
              <span>{p.semestre}.º semestre</span>
            </div>
          </div>

          <div className="side-hero">
            <span className="side-label">Número de control</span>
            <span className="side-big">{p.numeroControl}</span>
          </div>

          <dl className="side-fields">
            <Campo k="Correo institucional" v={p.email} ancho />
            <Campo k="Promedio aritmético" v={n1(p.promedioAritmetico, 2)} />
            <Campo k="Créditos acumulados" v={String(p.creditosAcumulados)} />
            <Campo k="Materias cursadas" v={String(p.materiasCursadas)} />
            <Campo k="Materias aprobadas" v={String(p.materiasAprobadas)} />
            <Campo k="Sin acreditar" v={String(p.materiasNoAcreditadas)} />
            <Campo k="Avance con lo que cursas" v={`${n1(p.porcentajeAvanceCursando)}%`} />
          </dl>

          <ClasesHoy />
        </aside>
      </div>
    </div>
  )
}

function Kpi({
  icon: Icon,
  value,
  label,
  destacado,
  tono,
}: {
  icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>
  value: string
  label: string
  destacado?: boolean
  tono?: 'coral' | 'ok'
}) {
  return (
    <div className={`kpi ${destacado ? 'destacado' : ''} ${tono ? `tono-${tono}` : ''}`}>
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">{label}</span>
      <Icon size={22} aria-hidden />
    </div>
  )
}

function Campo({ k, v, ancho }: { k: string; v: string; ancho?: boolean }) {
  return (
    <div className={ancho ? 'ancho' : ''}>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}

/** Anillo de progreso: arco verde = avance real, arco dorado = proyección con materias en curso */
function Ring({ etiqueta, meta, actual, proyeccion }: { etiqueta: string; meta: number; actual: number; proyeccion: number }) {
  const R = 44
  const C = 2 * Math.PI * R
  const pct = Math.min(actual / meta, 1)
  const pctProy = Math.min(Math.max(proyeccion, actual) / meta, 1)
  const cumple = actual >= meta
  return (
    <figure className={`ring ${cumple ? 'cumple' : ''}`} aria-label={`${etiqueta}: ${n1(actual)} % de ${meta} %`}>
      <svg viewBox="0 0 110 110" width="118" height="118" aria-hidden>
        <circle cx="55" cy="55" r={R} className="ring-track" />
        <circle cx="55" cy="55" r={R} className="ring-proy" strokeDasharray={`${C * pctProy} ${C}`} />
        <circle cx="55" cy="55" r={R} className="ring-val" strokeDasharray={`${C * pct} ${C}`} />
      </svg>
      <div className="ring-center">
        <small>{etiqueta}</small>
        <strong>{cumple ? '✓' : `${Math.round(pct * 100)}%`}</strong>
      </div>
      <figcaption>
        {cumple ? 'Cumplido' : `Faltan ${n1(meta - actual)} pts`} <span>meta {meta} %</span>
      </figcaption>
    </figure>
  )
}

function SemiGauge({ valor, max }: { valor: number; max: number }) {
  const R = 70
  const L = Math.PI * R
  const pct = Math.min(valor / max, 1)
  return (
    <figure className="semi" aria-label={`${valor} de ${max} créditos complementarios`}>
      <svg viewBox="0 0 180 104" width="220" height="128" aria-hidden>
        <path d="M20 94 A70 70 0 0 1 160 94" className="semi-track" />
        <path d="M20 94 A70 70 0 0 1 160 94" className="semi-val" strokeDasharray={`${L * pct} ${L}`} />
      </svg>
      <div className="semi-center">
        <strong>{Math.round(pct * 100)}%</strong>
        <small>
          {valor} de {max}
        </small>
      </div>
    </figure>
  )
}

function PromedioChart() {
  const { data, loading, error, reload } = useApi(() => api.get<Kardex>('/kardex'))
  const serie = (data?.semestres ?? [])
    .filter((s) => s.promedio !== null)
    .map((s) => ({ sem: `${s.semestre}.º`, promedio: s.promedio }))

  return (
    <section className="board-card chart-card">
      <header className="card-head">
        <h2>
          <TrendingUp size={17} aria-hidden /> Promedio por semestre
        </h2>
        {data && (
          <span className="chip-dark">
            Promedio general {n1(data.resumen.promedio)}
          </span>
        )}
      </header>
      {loading && <Skeleton h={240} r={12} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && serie.length > 0 && (
        <div role="img" aria-label={`Promedios por semestre: ${serie.map((s) => `${s.sem} ${s.promedio}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={serie} margin={{ top: 16, right: 12, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ade80" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,.06)" />
              <XAxis dataKey="sem" tickLine={false} axisLine={false} tick={{ fill: '#8fb39c', fontSize: 12 }} />
              <YAxis domain={[60, 100]} tickLine={false} axisLine={false} tick={{ fill: '#8fb39c', fontSize: 12 }} />
              <ReferenceLine y={70} stroke="#ff7a6b" strokeDasharray="4 6" strokeOpacity={0.7} />
              <Tooltip
                cursor={{ stroke: 'rgba(255,255,255,.25)', strokeDasharray: '3 3' }}
                formatter={(v) => [n1(Number(v)), 'Promedio']}
                labelFormatter={(l) => `Semestre ${l}`}
                contentStyle={{ background: '#0b1d13', border: '1px solid #285a3b', borderRadius: 10, color: '#e8f5ec' }}
                itemStyle={{ color: '#86efac' }}
                labelStyle={{ color: '#a7c9b3' }}
              />
              <Area
                type="monotone"
                dataKey="promedio"
                stroke="#6ee7a0"
                strokeWidth={3}
                fill="url(#gArea)"
                className="glow-line"
                dot={{ r: 3, fill: '#0f2a1b', stroke: '#6ee7a0', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#ffffff', stroke: '#4ade80', strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

function ClasesHoy() {
  const { data, loading, error } = useApi(() => api.get<Horario>('/horario'))
  const hoy = DIA_HOY === 'domingo' ? null : DIA_HOY
  const clases =
    data && hoy
      ? data.materias
          .flatMap((m) => m.sesiones.filter((s) => s.dia === hoy).map((s) => ({ ...s, nombre: m.nombre })))
          .sort((a, b) => a.inicio.localeCompare(b.inicio))
      : []
  return (
    <section className="side-today">
      <h2>
        <Clock size={16} aria-hidden /> {hoy ? `Clases del ${DIA_LABEL[hoy].toLowerCase()}` : 'Hoy no hay clases'}
      </h2>
      {loading && <Skeleton h={80} r={10} />}
      {error && !error.isAuth && <p className="side-muted">No pudimos cargar tu horario.</p>}
      {!loading && !error && hoy && clases.length === 0 && <p className="side-muted">No tienes clases registradas hoy.</p>}
      <ol>
        {clases.map((c) => (
          <li key={c.nombre + c.inicio}>
            <time>
              {c.inicio}–{c.fin}
            </time>
            <span>{titulo(c.nombre)}</span>
            {c.salon && (
              <small>
                <MapPin size={12} aria-hidden /> {c.salon}
              </small>
            )}
          </li>
        ))}
      </ol>
      <Link to="/horario" className="side-link">
        <BookOpen size={15} aria-hidden /> Ver horario completo
      </Link>
    </section>
  )
}

function DashboardSkeleton() {
  return (
    <div className="page dash-page" aria-busy="true" aria-label="Cargando tu información">
      <div className="board">
        <section className="board-main">
          <Skeleton h={44} w="40%" />
          <div className="kpis">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} h={130} r={14} />
            ))}
          </div>
          <Skeleton h={290} r={16} />
          <div className="gauges">
            <Skeleton h={230} r={16} />
            <Skeleton h={230} r={16} />
          </div>
        </section>
        <aside className="board-side">
          <Skeleton h={52} w="70%" />
          <Skeleton h={90} r={12} />
          <Skeleton h={260} r={12} />
        </aside>
      </div>
    </div>
  )
}
