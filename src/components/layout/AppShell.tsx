import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'

export function AppShell({ children, route, onNavigate }: { children: ReactNode; route: string; onNavigate: (route: string) => void }) {
  return <div className="app-shell"><Sidebar route={route} onNavigate={onNavigate} /><div className="app-main"><TopNav route={route} /><main>{children}</main></div></div>
}
