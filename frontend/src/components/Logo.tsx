export function Logo({ sub = 'TecNM Celaya', size = 44 }: { sub?: string; size?: number }) {
  return (
    <div className="logo">
      <img src="/logo-linces.webp" width={size} height={size} alt="" className="logo-img" />
      <div>
        <span className="logo-name">Linces ITC</span>
        {sub && <span className="logo-sub">{sub}</span>}
      </div>
    </div>
  )
}
