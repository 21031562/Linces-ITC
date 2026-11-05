#!/usr/bin/env node
/**
 * Auditoría de seguridad de Linces ITC (caja negra + revisión del repositorio).
 * Sin dependencias: Node 22+.
 *
 * Uso:
 *   node tools/auditoria.mjs --url http://localhost:5173
 *   node tools/auditoria.mjs --url https://linces-itc.onrender.com \
 *        --bff https://linces-bff.onrender.com --vacantes https://linces-vacantes.onrender.com \
 *        --supabase https://REF_CORE.supabase.co=sb_publishable_xxx \
 *        --supabase https://REF_VAC.supabase.co=sb_publishable_yyy
 *
 * Opcionales:
 *   --rate     prueba el límite de intentos de login (usa un correo ficticio, no bloquea tu cuenta)
 *   --no-repo  omite la revisión de archivos del repositorio
 *   Credenciales: variables AUDIT_EMAIL y AUDIT_PASSWORD o se piden al iniciar (la contraseña no se muestra).
 *
 * El script NUNCA imprime tokens, cookies ni contraseñas: solo si pasan o no las pruebas.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

// ── Argumentos ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const optAll = (name) => args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]] : []))
const BASE = (opt('url') ?? 'http://localhost:5173').replace(/\/$/, '')
const BFF = opt('bff')?.replace(/\/$/, '')
const VAC = opt('vacantes')?.replace(/\/$/, '')
const SUPA = optAll('supabase').map((s) => {
  const i = s.lastIndexOf('=')
  return { url: s.slice(0, i).replace(/\/$/, ''), key: s.slice(i + 1) }
})
const HTTPS = BASE.startsWith('https://')

// ── Salida ──────────────────────────────────────────────────────────────────
const C = { ok: '\x1b[32m', fail: '\x1b[31m', warn: '\x1b[33m', dim: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }
const res = { ok: 0, fail: 0, warn: 0 }
const fallas = []
function report(tipo, titulo, detalle = '') {
  res[tipo]++
  const tag = tipo === 'ok' ? `${C.ok}✔ PASA ${C.x}` : tipo === 'fail' ? `${C.fail}✘ FALLA${C.x}` : `${C.warn}▲ AVISO${C.x}`
  console.log(`  ${tag} ${titulo}${detalle ? `\n         ${C.dim}${detalle}${C.x}` : ''}`)
  if (tipo === 'fail') fallas.push(titulo)
}
const check = (cond, titulo, siFalla, tipoFalla = 'fail') => report(cond ? 'ok' : tipoFalla, titulo, cond ? '' : siFalla)
const seccion = (t) => console.log(`\n${C.b}${t}${C.x}`)

// ── Utilidades ──────────────────────────────────────────────────────────────
const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/
const SECRET_RE = /sb_secret_[A-Za-z0-9_-]{10,}/
const CLAVES_PROHIBIDAS = ['token', 'token_cifrado', 'id_hash', 'password', 'password_hash', 'secret', 'apikey', 'authorization']

/** Busca recursivamente llaves o valores sensibles en un JSON */
function buscarSensibles(obj, ruta = '$', hallazgos = []) {
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const r = `${ruta}.${k}`
      if (CLAVES_PROHIBIDAS.includes(k.toLowerCase())) hallazgos.push(`llave "${k}" en ${r}`)
      buscarSensibles(v, r, hallazgos)
    }
  } else if (typeof obj === 'string') {
    if (JWT_RE.test(obj)) hallazgos.push(`JWT en ${ruta}`)
    if (SECRET_RE.test(obj)) hallazgos.push(`secret key de Supabase en ${ruta}`)
  }
  return hallazgos
}

class Jar {
  constructor() {
    this.c = new Map()
  }
  store(res) {
    for (const sc of res.headers.getSetCookie?.() ?? []) {
      const [pair] = sc.split(';')
      const i = pair.indexOf('=')
      const name = pair.slice(0, i).trim()
      const val = pair.slice(i + 1).trim()
      if (!val || /max-age=0|expires=thu, 01 jan 1970/i.test(sc)) this.c.delete(name)
      else this.c.set(name, val)
    }
  }
  header() {
    return [...this.c].map(([k, v]) => `${k}=${v}`).join('; ')
  }
}

async function http(url, { method = 'GET', body, jar, headers = {}, csrf = true } = {}) {
  const h = { Accept: 'application/json', ...headers }
  if (body !== undefined) h['Content-Type'] = 'application/json'
  if (csrf && method !== 'GET') h['x-linces-csrf'] = '1'
  if (jar?.header()) h.Cookie = jar.header()
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 90_000)
  try {
    const r = await fetch(url, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: 'manual', signal: ctrl.signal })
    jar?.store(r)
    const text = await r.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {}
    return { status: r.status, headers: r.headers, text, json }
  } catch (e) {
    return { status: 0, headers: new Headers(), text: '', json: null, error: e.cause?.code ?? e.message }
  } finally {
    clearTimeout(t)
  }
}

function preguntar(q, oculto = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    if (oculto) rl._writeToOutput = (s) => (s.includes(q) ? process.stdout.write(s) : null)
    rl.question(q, (a) => {
      rl.close()
      if (oculto) process.stdout.write('\n')
      resolve(a.trim())
    })
  })
}

// ── Pruebas ─────────────────────────────────────────────────────────────────
async function frontend() {
  seccion(`1. Frontend y bundle público (${BASE})`)
  const r = await http(`${BASE}/`, { headers: { Accept: 'text/html' } })
  if (r.status !== 200) return report('fail', 'El frontend responde', `HTTP ${r.status} ${r.error ?? ''}. ¿Está corriendo?`)
  const assets = [...r.text.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css))"/g)].map((m) => m[1])
  const prod = assets.some((a) => a.startsWith('/assets/'))
  let encontrados = []
  const textos = []
  if (prod) {
    for (const a of assets) {
      const t = (await http(`${BASE}${a}`, { headers: { Accept: '*/*' } })).text
      textos.push(t)
      const mapa = await http(`${BASE}${a}.map`, { headers: { Accept: '*/*' } })
      if (mapa.status === 200 && mapa.text.includes('"sources"')) report('warn', `Source map público: ${a}.map`, 'Expone el código fuente original. Desactívalo con build.sourcemap=false.')
    }
    // también los chunks importados dinámicamente
    const extra = new Set(textos.join('\n').match(/assets\/[A-Za-z0-9_-]+\.js/g) ?? [])
    for (const e of extra) textos.push((await http(`${BASE}/${e}`, { headers: { Accept: '*/*' } })).text)
  } else {
    report('warn', 'Frontend en modo desarrollo (Vite)', 'El bundle real y las cabeceras CSP/HSTS solo se pueden auditar en producción (npm run build && npm start, o la URL de Render).')
  }
  const todo = textos.join('\n')
  const patrones = [
    [SECRET_RE, 'secret key de Supabase'],
    [/service_role/, 'mención a service_role'],
    [JWT_RE, 'un JWT incrustado'],
    [/x-gateway-key|x-internal-key/i, 'nombres de llaves internas'],
    [/sii\.celaya\.tecnm\.mx\/api/, 'URL del API del SII (el navegador no debe conocerla)'],
    [/localhost:4000|localhost:4100/, 'URLs internas de los backends'],
  ]
  if (BFF) patrones.push([new RegExp(new URL(BFF).host.replace(/\./g, '\\.')), 'URL del BFF'])
  if (VAC) patrones.push([new RegExp(new URL(VAC).host.replace(/\./g, '\\.')), 'URL de vacantes-service'])
  if (prod) {
    encontrados = patrones.filter(([re]) => re.test(todo)).map(([, n]) => n)
    check(encontrados.length === 0, `El JavaScript público no contiene secretos ni URLs internas (${textos.length} archivos)`, `Encontrado: ${encontrados.join(', ')}`)
  }

  const h = r.headers
  const csp = h.get('content-security-policy') ?? ''
  if (prod || HTTPS) {
    check(/connect-src 'self'/.test(csp), "CSP limita las conexiones del navegador a su propio dominio (connect-src 'self')", `CSP actual: ${csp || '(ninguna)'}`)
    check(/frame-ancestors 'none'/.test(csp), 'CSP impide incrustar la página en iframes (clickjacking)', `CSP actual: ${csp || '(ninguna)'}`)
    check(h.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff', 'Falta la cabecera.')
    if (HTTPS) check(!!h.get('strict-transport-security'), 'HSTS activo (fuerza HTTPS)', 'Falta Strict-Transport-Security. ¿NODE_ENV=production en linces-itc?')
  }
  check(!h.get('x-powered-by'), 'No revela la tecnología del servidor (X-Powered-By)', `X-Powered-By: ${h.get('x-powered-by')}`, 'warn')
}

async function sesionAlumno(email, password) {
  seccion('2. Login y cookie de sesión del alumno')
  const jar = new Jar()

  const vacio = await http(`${BASE}/api/auth/login`, { method: 'POST', body: { email: '', password: '' }, jar: new Jar() })
  check(vacio.status === 400, 'Campos vacíos se rechazan en el servidor (400)', `HTTP ${vacio.status}`)

  const login = await http(`${BASE}/api/auth/login`, { method: 'POST', body: { email, password }, jar })
  if (login.status !== 200) {
    report('fail', 'Login con tu cuenta', `HTTP ${login.status}: ${login.json?.error?.message ?? login.error ?? login.text.slice(0, 120)}`)
    return null
  }
  report('ok', 'Login con tu cuenta')
  const sens = buscarSensibles(login.json)
  check(sens.length === 0 && !JWT_RE.test(login.text), 'La respuesta del login NO contiene el token del SII', sens.join('; '))

  const sc = login.headers.getSetCookie?.() ?? []
  const cookie = sc.find((c) => /linces_sid=/.test(c)) ?? ''
  const [par] = cookie.split(';')
  const nombre = par.split('=')[0]
  const valor = par.slice(nombre.length + 1)
  check(!!cookie, 'Se crea la cookie de sesión', 'No llegó Set-Cookie con linces_sid.')
  if (cookie) {
    check(/;\s*httponly/i.test(cookie), 'Cookie HttpOnly (JavaScript no puede leerla)', cookie.replace(valor, '***'))
    check(/;\s*samesite=(lax|strict)/i.test(cookie), 'Cookie SameSite=Lax/Strict (mitiga CSRF)', cookie.replace(valor, '***'))
    check(!/;\s*domain=/i.test(cookie), 'Cookie sin atributo Domain (no se comparte con subdominios)', cookie.replace(valor, '***'))
    check(!JWT_RE.test(valor) && !valor.includes('.'), 'El valor de la cookie es un ID opaco, no un JWT', 'La cookie parece contener un token.')
    check(valor.length >= 40, 'El ID de sesión es largo y aleatorio (≥ 256 bits)', `Longitud ${valor.length}`)
    if (HTTPS) {
      check(/;\s*secure/i.test(cookie), 'Cookie Secure (solo viaja por HTTPS)', 'Falta Secure. ¿NODE_ENV=production en el BFF?')
      check(nombre.startsWith('__Host-'), 'Cookie con prefijo __Host- (no se puede sobrescribir)', `Nombre: ${nombre}`)
    } else report('warn', 'Secure y __Host- solo se exigen en HTTPS', 'En local (http) es normal que no estén. Corre la auditoría contra Render para verificarlo.')
  }
  check(!login.headers.get('x-powered-by'), 'La API no revela X-Powered-By', `X-Powered-By: ${login.headers.get('x-powered-by')}`, 'warn')
  return jar
}

async function datos(jar) {
  seccion('3. Respuestas de la API (¿se filtra algo?)')
  const rutas = ['/api/auth/session', '/api/estudiante', '/api/calificaciones', '/api/kardex', '/api/horario', '/api/vacantes', '/api/postulaciones']
  for (const ruta of rutas) {
    const r = await http(`${BASE}${ruta}`, { jar })
    if (r.status !== 200) {
      report('fail', `${ruta} responde`, `HTTP ${r.status}: ${r.json?.error?.message ?? r.error ?? ''}`)
      continue
    }
    const sens = buscarSensibles(r.json)
    check(sens.length === 0 && !JWT_RE.test(r.text) && !SECRET_RE.test(r.text), `${ruta} sin tokens ni llaves`, sens.join('; '))
    check(/no-store/.test(r.headers.get('cache-control') ?? ''), `${ruta} con Cache-Control: no-store`, `Cache-Control: ${r.headers.get('cache-control')}`, 'warn')
    check(!r.headers.get('access-control-allow-origin'), `${ruta} sin CORS abierto`, `Access-Control-Allow-Origin: ${r.headers.get('access-control-allow-origin')}`)
  }
}

async function accesos(jar) {
  seccion('4. Control de acceso y CSRF')
  const sin = await http(`${BASE}/api/estudiante`)
  check(sin.status === 401, 'Sin cookie no se pueden leer datos (401)', `HTTP ${sin.status}`)

  const falsa = new Jar()
  falsa.c.set([...jar.c.keys()][0] ?? 'linces_sid', 'A'.repeat(43))
  const f = await http(`${BASE}/api/estudiante`, { jar: falsa })
  check(f.status === 401, 'Una cookie inventada o alterada se rechaza (401)', `HTTP ${f.status}`)

  const noCsrf = await http(`${BASE}/api/auth/logout`, { method: 'POST', body: {}, jar, csrf: false })
  check(noCsrf.status === 403, 'POST sin header anti-CSRF se rechaza (403)', `HTTP ${noCsrf.status}`)
  const evil = await http(`${BASE}/api/auth/logout`, { method: 'POST', body: {}, jar, headers: { Origin: 'https://sitio-malicioso.example' } })
  check(evil.status === 403, 'POST desde otro origen se rechaza (403)', `HTTP ${evil.status}`)

  const ajena = await http(`${BASE}/api/postulaciones/00000000-0000-4000-8000-000000000000/cancelar`, { method: 'POST', body: {}, jar })
  check(ajena.status !== 200, 'No se puede cancelar una postulación que no es tuya', `HTTP ${ajena.status}`)

  const adm = await http(`${BASE}/admin-api/estadisticas`, { jar })
  check(adm.status === 401, 'La sesión de alumno no da acceso al panel de administración', `HTTP ${adm.status}`)

  for (const p of ['/admin-api/../internal/vacantes', '/admin-api/%2e%2e/internal/vacantes', '/api/../internal/vacantes']) {
    const r = await http(`${BASE}${p}`, { jar })
    check(!(r.status === 200 && Array.isArray(r.json?.data)), `Sin acceso a /internal por el gateway (${p})`, `HTTP ${r.status}`)
  }
}

async function cierre(jar) {
  seccion('5. Cierre de sesión')
  const antes = jar.header()
  const out = await http(`${BASE}/api/auth/logout`, { method: 'POST', body: {}, jar })
  check(out.status === 200, 'Logout responde 200', `HTTP ${out.status}`)
  const viejo = new Jar()
  for (const kv of antes.split('; ')) {
    const i = kv.indexOf('=')
    if (i > 0) viejo.c.set(kv.slice(0, i), kv.slice(i + 1))
  }
  const r = await http(`${BASE}/api/estudiante`, { jar: viejo })
  check(r.status === 401, 'Tras el logout, la cookie anterior ya no sirve (sesión revocada en el servidor)', `HTTP ${r.status}`)
}

async function backendsDirectos() {
  seccion('6. Acceso directo a los backends (sin pasar por el gateway)')
  if (!BFF && !VAC) return report('warn', 'Omitido', 'Pasa --bff y --vacantes con sus URLs de Render para probarlo.')
  if (BFF) {
    const r = await http(`${BFF}/estudiante`)
    if (r.status === 404) report('ok', 'El BFF no responde a peticiones sin x-gateway-key (404)')
    else if (r.status === 401) report(HTTPS ? 'fail' : 'warn', 'El BFF acepta peticiones directas', 'GATEWAY_KEY no está configurada en el BFF. En Render debe estar definida.')
    else report('warn', `BFF directo respondió HTTP ${r.status}`, r.error ?? '')
    const cors = await http(`${BFF}/health`, { method: 'OPTIONS', headers: { Origin: 'https://sitio-malicioso.example', 'Access-Control-Request-Method': 'POST' }, csrf: false })
    check(!cors.headers.get('access-control-allow-origin'), 'El BFF no habilita CORS para otros sitios', `ACAO: ${cors.headers.get('access-control-allow-origin')}`)
  }
  if (VAC) {
    const i = await http(`${VAC}/internal/vacantes`)
    check(i.status === 404, 'vacantes-service: /internal exige x-internal-key (404 sin ella)', `HTTP ${i.status}`)
    const a = await http(`${VAC}/admin/auth/me`)
    if (a.status === 404) report('ok', 'vacantes-service: /admin exige x-gateway-key (404)')
    else if (a.status === 401) report(HTTPS ? 'fail' : 'warn', 'vacantes-service: /admin acepta peticiones directas', 'GATEWAY_KEY no está configurada en vacantes-service.')
    else report('warn', `/admin directo respondió HTTP ${a.status}`, a.error ?? '')
  }
}

async function supabase() {
  seccion('7. Supabase con la llave PÚBLICA (publishable/anon)')
  if (!SUPA.length) return report('warn', 'Omitido', 'Pasa --supabase URL=PUBLISHABLE_KEY por cada proyecto (Settings → API Keys). Nunca la secret key.')
  const tablas = ['sesiones', 'auditoria', 'organizaciones', 'vacantes', 'postulaciones', 'admins', 'admin_sesiones', 'bitacora_admin', 'vacantes_resumen']
  for (const { url, key } of SUPA) {
    if (/^sb_secret_/.test(key)) {
      report('fail', `${url}: pasaste una SECRET key`, 'Esta prueba es con la llave pública. No uses la secret key fuera del servidor.')
      continue
    }
    for (const t of tablas) {
      const r = await http(`${url}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}) } })
      if (r.json?.code === 'PGRST205' || r.status === 404) continue // la tabla no es de este proyecto
      if (r.status === 200 && Array.isArray(r.json) && r.json.length) report('fail', `${t}: la llave pública puede LEER datos`, `${url} — revisa RLS y permisos (vuelve a correr el SQL).`)
      else if (r.status === 200) report('warn', `${t}: la llave pública tiene permiso de consulta (devuelve vacío por RLS)`, 'Funciona, pero el SQL del proyecto revoca estos permisos; vuelve a correrlo.')
      else report('ok', `${t}: la llave pública no tiene acceso (HTTP ${r.status})`)
    }
  }
}

async function rateLimit() {
  seccion('8. Límite de intentos de login')
  if (!args.includes('--rate')) return report('warn', 'Omitido', 'Agrega --rate para probarlo (usa un correo ficticio; tu cuenta no se bloquea).')
  let limitado = false
  for (let i = 0; i < 12 && !limitado; i++) {
    const r = await http(`${BASE}/api/auth/login`, { method: 'POST', body: { email: 'auditoria-limite@ejemplo.com', password: `x${i}` }, jar: new Jar() })
    limitado = r.status === 429
  }
  check(limitado, 'Tras ~10 intentos fallidos el servidor responde 429', 'No se activó el límite.')
}

function repo() {
  seccion('9. Repositorio (archivos y secretos)')
  if (args.includes('--no-repo')) return report('warn', 'Omitido')
  const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
  if (!existsSync(path.join(raiz, 'bff'))) return report('warn', 'No se encontró el repositorio junto al script')

  const gi = existsSync(path.join(raiz, '.gitignore')) ? readFileSync(path.join(raiz, '.gitignore'), 'utf8') : ''
  check(/^\.env$/m.test(gi), '.gitignore excluye los archivos .env', 'Agrega ".env" a .gitignore.')
  try {
    const tracked = execSync('git ls-files', { cwd: raiz, stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\n')
    const envs = tracked.filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.example'))
    check(envs.length === 0, 'Ningún .env está versionado en git', `Versionados: ${envs.join(', ')}. Bórralos con git rm --cached y ROTA las llaves.`)
  } catch {
    report('warn', 'No es un repositorio git todavía', 'Cuando lo subas a GitHub vuelve a correr la auditoría.')
  }

  const hallazgos = []
  const recorrer = (dir) => {
    for (const n of readdirSync(dir)) {
      if (['node_modules', 'dist', '.git'].includes(n) || n === '.env') continue
      const p = path.join(dir, n)
      const st = statSync(p)
      if (st.isDirectory()) recorrer(p)
      else if (st.size < 2_000_000 && /\.(ts|tsx|js|mjs|json|sql|md|ya?ml|example)$/.test(n)) {
        const t = readFileSync(p, 'utf8')
        // Ignora los marcadores de ejemplo (sb_secret_xxxx…)
        if ((t.match(new RegExp(SECRET_RE, 'g')) ?? []).some((m) => !/^sb_secret_x+$/.test(m))) hallazgos.push(`${path.relative(raiz, p)}: secret key de Supabase`)
        if (JWT_RE.test(t) && !p.endsWith('auditoria.mjs')) hallazgos.push(`${path.relative(raiz, p)}: JWT`)
        if (/\.env\.example$/.test(n) && /^(SESSION_ENC_KEY|INTERNAL_KEY|VACANTES_INTERNAL_KEY|GATEWAY_KEY)=\S{16,}/m.test(t)) hallazgos.push(`${path.relative(raiz, p)}: llave real en el ejemplo`)
      }
    }
  }
  recorrer(raiz)
  check(hallazgos.length === 0, 'No hay llaves ni tokens escritos en el código fuente', hallazgos.join('; '))

  for (const d of ['bff', 'vacantes-service']) {
    const envp = path.join(raiz, d, '.env')
    if (!existsSync(envp)) continue
    const env = readFileSync(envp, 'utf8')
    if (/SUPABASE_\w*SECRET_KEY=sb_publishable_/.test(env)) report('fail', `${d}/.env usa la llave publishable donde va la secret`, 'Usa la Secret key.')
    const enc = env.match(/^SESSION_ENC_KEY=(.*)$/m)?.[1]
    if (d === 'bff') check(!!enc && enc.length >= 32, 'SESSION_ENC_KEY tiene al menos 32 caracteres', 'Genérala con crypto.randomBytes(32).')
  }
  const bffEnv = existsSync(path.join(raiz, 'bff/.env')) ? readFileSync(path.join(raiz, 'bff/.env'), 'utf8') : ''
  const vacEnv = existsSync(path.join(raiz, 'vacantes-service/.env')) ? readFileSync(path.join(raiz, 'vacantes-service/.env'), 'utf8') : ''
  const a = bffEnv.match(/^VACANTES_INTERNAL_KEY=(.*)$/m)?.[1]
  const b = vacEnv.match(/^INTERNAL_KEY=(.*)$/m)?.[1]
  if (a && b) check(a === b, 'La llave interna BFF ↔ vacantes coincide', 'VACANTES_INTERNAL_KEY (bff) y INTERNAL_KEY (vacantes) son distintas.')

  try {
    for (const d of ['bff', 'vacantes-service', 'frontend']) {
      const out = execSync('npm audit --omit=dev --json', { cwd: path.join(raiz, d), stdio: ['ignore', 'pipe', 'ignore'] }).toString()
      const v = JSON.parse(out).metadata?.vulnerabilities ?? {}
      const graves = (v.high ?? 0) + (v.critical ?? 0)
      check(graves === 0, `${d}: sin dependencias con vulnerabilidades altas o críticas`, `high=${v.high} critical=${v.critical}. Corre npm audit fix.`)
    }
  } catch (e) {
    const out = e.stdout?.toString()
    if (out) {
      const v = JSON.parse(out).metadata?.vulnerabilities ?? {}
      report((v.high ?? 0) + (v.critical ?? 0) ? 'fail' : 'warn', 'npm audit encontró vulnerabilidades', JSON.stringify(v))
    } else report('warn', 'No se pudo correr npm audit', 'Sin internet o sin node_modules.')
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log(`${C.b}Auditoría de seguridad · Linces ITC${C.x}\nObjetivo: ${BASE}${HTTPS ? '' : `  ${C.warn}(HTTP local: algunas pruebas de producción se marcan como aviso)${C.x}`}`)
const email = process.env.AUDIT_EMAIL || (await preguntar('Correo del SII: '))
const password = process.env.AUDIT_PASSWORD || (await preguntar('Contraseña (no se muestra): ', true))

await frontend()
const jar = await sesionAlumno(email, password)
if (jar) {
  await datos(jar)
  await accesos(jar)
  await cierre(jar)
}
await backendsDirectos()
await supabase()
await rateLimit()
repo()

console.log(`\n${C.b}Resultado:${C.x} ${C.ok}${res.ok} pasan${C.x}, ${C.fail}${res.fail} fallan${C.x}, ${C.warn}${res.warn} avisos${C.x}`)
if (fallas.length) console.log(`${C.fail}Corrige primero:${C.x}\n  - ${fallas.join('\n  - ')}`)
process.exit(res.fail ? 1 : 0)
