import { Button, Card, StatusBadge } from '../ui'

export function QuestCard({ title, description, status, label, onOpen }: { title: string; description: string; status: 'active' | 'complete' | 'neutral'; label: string; onOpen: () => void }) {
  return <Card className="quest-card"><div className="quest-card-top"><StatusBadge tone={status}>{label}</StatusBadge><span className="quest-arrow">↗</span></div><h3>{title}</h3><p>{description}</p><Button variant="ghost" onClick={onOpen}>Open quest <span>→</span></Button></Card>
}
