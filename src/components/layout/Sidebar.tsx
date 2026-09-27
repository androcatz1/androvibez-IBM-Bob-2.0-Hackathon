const links = [
  ['home', 'Overview'],
  ['dashboard', 'Dashboard'],
  ['stage-explore', 'Explore'],
  ['stage-architecture', 'Architecture'],
  ['stage-knowledge', 'Knowledge'],
  ['stage-investigation', 'Investigation'],
  ['stage-predict', 'Predict Change'],
  ['stage-contribution', 'Contribution'],
]

export function Sidebar({ route, onNavigate }: { route: string; onNavigate: (route: string) => void }) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => onNavigate('home')}>
        <span className="brand-mark">OQ</span>
        <span>Onboarding<span className="brand-muted">Quest</span></span>
      </button>
      <p className="nav-label">Workspace</p>
      <nav>
        {links.map(([id, label], index) => (
          <button
            key={id}
            className={`nav-item ${route === id ? 'is-active' : ''}`}
            onClick={() => onNavigate(id)}
          >
            <span className="nav-number">{String(index + 1).padStart(2, '0')}</span>
            {label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="avatar">JD</div>
        <div>
          <strong>Developer</strong>
          <small>New contributor</small>
        </div>
      </div>
    </aside>
  )
}
