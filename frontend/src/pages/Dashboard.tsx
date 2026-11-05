import { Award, BookCheck, Briefcase, CircleAlert, Clock, Layers, Sparkles, TrendingUp } from 'lucide-react'
import { Link } from 'react-router'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CreditTrack } from '../components/CreditTrack'
import { ErrorState, Skeleton } from '../components/Feedback'
import { Avatar, usePerfil } from '../components/Layout'
import { api } from '../lib/api'
import { DIA_HOY, DIA_LABEL, n1, nombreCompleto, nombrePila, titulo } from '../lib/format'
import type { Horario, Kardex } from '../lib/types'
import { useApi } from '../lib/useApi'

function saludo() {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

export default function Dashboard() {
  const { perfil, loading, error, reload } = usePerfil()

  if (error) return <ErrorState error={error} onRetry={reload} />
  if (loading || !perfil) return <DashboardSkeleton />

  const stats = [
    { icon: Award, label: 'Promedio ponderado', value: n1(perfil.promedioPonderado, 2), tone: perfil.promedioPonderado >= 85 ? 'verde' : perfil.promedioPonderado >= 70 ? 'amarillo' : 'rojo' },
    { icon: Layers, label: 'Créditos acumulados', value: n1(perfil.creditosAcumulados, 0), tone: 'azul' },
    { icon: BookCheck, label: 'Materias aprobadas', value: `${perfil.materiasAprobadas} de ${perfil.materiasCursadas}`, tone: 'azul' },
    {
      icon: CircleAlert,
      label: 'Materias reprobadas',
      value: String(perfil.materiasReprobadas),
      tone: perfil.materiasReprobadas > 0 ? 'rojo' : 'verde',
    },
    {
      icon: Sparkles,
      label: 'Créditos complementarios',
      value: `${perfil.creditosComplementarios} de 5`,
      tone: perfil.creditosComplementarios >= 5 ? 'verde' : 'amarillo',
    },
  ]

  return (
    <div className="page dashboard">
      <section className="hero">
        <div className="hero-id">
          <Avatar perfil={perfil} size={64} />
          <div>
            <p className="hero-greet">
              {saludo()}, {nombrePila(perfil.nombre)}
            </p>
            <h1>{nombreCompleto(perfil.nombre)}</h1>
            <p className="muted">
              {perfil.semestre}.º semestre <span className="sep" /> No. de control {perfil.numeroControl} <span className="sep" /> {perfil.email}
            </p>
          </div>
        </div>
        <CreditTrack avance={perfil.porcentajeAvance} cursando={perfil.porcentajeAvanceCursando} />
      </section>

      <section className="stats" aria-label="Indicadores académicos">
        {stats.map(({ icon: Icon, label, value, tone }) => (
          <div key={label} className={`stat tone-${tone}`}>
            <Icon size={20} aria-hidden />
            <span className="stat-value">{value}</span>
            <span className="stat-label">{label}</span>
          </div>
        ))}
      </section>

      <div className="dash-grid">
        <PromedioSemestre />
        <div className="dash-side">
          <Elegibilidad />
          <ClasesHoy />
        </div>
      </div>
    </div>
  )
}

function Elegibilidad() {
  const { perfil } = usePerfil()
  if (!perfil) return null
  return (
    <section className="panel">
      <h2 className="panel-title">
        <Briefcase size={18} aria-hidden /> ¿Ya puedes iniciar?
      </h2>
      <ul className="eleg-list">
        {perfil.elegibilidad.map((e) => (
          <li key={e.tipo} className={e.cumple ? 'ok' : ''}>
            <strong>{e.tipo === 'servicio_social' ? 'Servicio social' : 'Residencia profesional'}</strong>
            <span>{e.cumple ? `Cumples el ${e.requerido} % de créditos requerido.` : `Te faltan ${n1(e.faltante)} puntos de avance para llegar al ${e.requerido} %.`}</span>
            {e.nota && <small className="muted">{e.nota}</small>}
          </li>
        ))}
      </ul>
      <Link to="/bolsa" className="btn primary block">
        Ver vacantes disponibles
      </Link>
    </section>
  )
}

function ClasesHoy() {
  const { data, loading, error } = useApi(() => api.get<Horario>('/horario'))
  const hoy = DIA_HOY === 'domingo' ? null : DIA_HOY
  const clases =
    data && hoy
      ? data.materias
          .flatMap((m) => m.sesiones.filter((s) => s.dia === hoy).map((s) => ({ ...s, nombre: m.nombre, color: m.color })))
          .sort((a, b) => a.inicio.localeCompare(b.inicio))
      : []
  return (
    <section className="panel">
      <h2 className="panel-title">
        <Clock size={18} aria-hidden /> {hoy ? `Tus clases del ${DIA_LABEL[hoy].toLowerCase()}` : 'Hoy no tienes clases'}
      </h2>
      {loading && <Skeleton h={90} />}
      {error && !error.isAuth && <p className="muted">No pudimos cargar tu horario: {error.message}</p>}
      {!loading && !error && hoy && clases.length === 0 && <p className="muted">No tienes clases registradas hoy.</p>}
      <ol className="today">
        {clases.map((c) => (
          <li key={c.nombre + c.inicio} className={`c${c.color}`}>
            <time>
              {c.inicio}–{c.fin}
            </time>
            <span>{titulo(c.nombre)}</span>
            {c.salon && <small>{c.salon}</small>}
          </li>
        ))}
      </ol>
      <Link to="/horario" className="link">
        Ver horario completo
      </Link>
    </section>
  )
}

function PromedioSemestre() {
  const { data, loading, error, reload } = useApi(() => api.get<Kardex>('/kardex'))
  const serie = (data?.semestres ?? []).filter((s) => s.promedio !== null).map((s) => ({ sem: `${s.semestre}.º`, promedio: s.promedio, creditos: s.creditos }))
  return (
    <section className="panel">
      <h2 className="panel-title">
        <TrendingUp size={18} aria-hidden /> Promedio por semestre
      </h2>
      {loading && <Skeleton h={260} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && serie.length > 0 && (
        <div className="chart" role="img" aria-label={`Promedios por semestre: ${serie.map((s) => `${s.sem} ${s.promedio}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={serie} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="sem" tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-2)', fontSize: 13 }} />
              <YAxis domain={[60, 100]} tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-2)', fontSize: 12 }} />
              <ReferenceLine y={70} stroke="var(--rojo)" strokeDasharray="4 4" label={{ value: 'Mínimo aprobatorio', position: 'insideBottomRight', fill: 'var(--rojo)', fontSize: 11 }} />
              <Tooltip
                cursor={{ fill: 'rgba(29,107,53,.07)' }}
                formatter={(v) => [n1(Number(v)), 'Promedio']}
                labelFormatter={(l) => `Semestre ${l}`}
                contentStyle={{ borderRadius: 10, border: '1px solid var(--line)', fontFamily: 'inherit' }}
              />
              <Bar dataKey="promedio" fill="var(--pri)" radius={[6, 6, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {data && (
        <p className="muted small">
          Promedio general de materias aprobadas: <strong>{n1(data.resumen.promedio)}</strong>, con {data.resumen.creditosAprobados} créditos en kardex.{' '}
          <Link to="/kardex" className="link">
            Ver kardex
          </Link>
        </p>
      )}
    </section>
  )
}

function DashboardSkeleton() {
  return (
    <div className="page dashboard" aria-busy="true" aria-label="Cargando tu información">
      <section className="hero">
        <div className="hero-id">
          <Skeleton h={64} w={64} r={32} />
          <div style={{ flex: 1, display: 'grid', gap: 8 }}>
            <Skeleton h={14} w={140} />
            <Skeleton h={30} w="60%" />
            <Skeleton h={14} w="45%" />
          </div>
        </div>
        <Skeleton h={120} r={12} />
      </section>
      <section className="stats">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} h={104} r={12} />
        ))}
      </section>
    </div>
  )
}
