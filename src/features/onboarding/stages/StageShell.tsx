/**
 * StageShell
 *
 * Shared layout for all 6 onboarding stages.
 * Renders a main content area + a right-hand journey map sidebar.
 */

import type { ReactNode } from 'react'
import { StatusBadge, Button } from '../../../components/ui'
import type { OnboardingStage } from '../questBuilder'

interface StageShellProps {
  stages: OnboardingStage[]
  currentStageId: string
  children: ReactNode
  onNavigate: (route: string) => void
}

const stageToRoute: Record<string, string> = {
  explore: 'stage-explore',
  architecture: 'stage-architecture',
  knowledge: 'stage-knowledge',
  investigation: 'stage-investigation',
  predict: 'stage-predict',
  contribution: 'stage-contribution',
}

export function StageShell({ stages, currentStageId, children, onNavigate }: StageShellProps) {
  return (
    <div className="stage-layout">
      <div className="stage-main">{children}</div>
      <aside className="stage-aside">
        <div className="aside-title">Journey map</div>
        <div className="stage-map">
          {stages.map((stage) => {
            const isCurrent = stage.id === currentStageId
            const isDone = stage.status === 'completed'
            const isLocked = stage.status === 'locked'
            return (
              <button
                key={stage.id}
                className={`stage-map-item ${isCurrent ? 'is-current' : ''} ${isDone ? 'is-done' : ''} ${isLocked ? 'is-locked' : ''}`}
                onClick={() => !isLocked && onNavigate(stageToRoute[stage.id])}
                disabled={isLocked}
                title={isLocked ? 'Complete previous stages first' : stage.title}
              >
                <span className="stage-map-num">{String(stage.index).padStart(2, '0')}</span>
                <span className="stage-map-label">{stage.title}</span>
                <StatusBadge
                  tone={isDone ? 'complete' : isCurrent ? 'active' : 'neutral'}
                >
                  {isDone ? 'Done' : isCurrent ? 'Now' : isLocked ? 'Locked' : 'Next'}
                </StatusBadge>
              </button>
            )
          })}
        </div>
        <div className="stage-aside-footer">
          <Button variant="ghost" onClick={() => onNavigate('dashboard')}>
            ← Back to dashboard
          </Button>
        </div>
      </aside>
    </div>
  )
}
