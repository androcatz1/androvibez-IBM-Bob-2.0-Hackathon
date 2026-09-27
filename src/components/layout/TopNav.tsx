const labels: Record<string, string> = { home: 'Overview', setup: 'Repository setup', dashboard: 'Onboarding dashboard', 'stage-explore': 'Explore the Codebase', 'stage-architecture': 'Understand the Architecture', 'stage-knowledge': 'Prove Your Knowledge', 'stage-investigation': 'Investigate a Problem', 'stage-predict': 'Predict a Change', 'stage-contribution': 'First Contribution' }

export function TopNav({ route }: { route: string }) {
  return <header className="top-nav"><div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{labels[route] ?? 'Workspace'}</strong></div><div className="top-actions"><span className="connection"><i /> Local session</span><button className="icon-button" aria-label="Notifications">•••</button><div className="avatar avatar-small">JD</div></div></header>
}
