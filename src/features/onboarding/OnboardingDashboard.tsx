/**
 * OnboardingDashboard
 *
 * The central hub of the onboarding journey.
 * Displays a project overview and the 6-stage quest progression
 * derived from the live RepositoryAnalysis.
 */

import { Card, ProgressBar, StatusBadge, Button } from '../../components/ui'
import { AnalysisPanel } from './AnalysisPanel'
import { buildOnboardingJourney } from './questBuilder'
import type { RepositoryAnalysis } from '../../types'
import type { ParsedRepository } from '../../services/repository-analysis'
import type { AnalysisStatus } from '../../hooks/useRepositoryAnalysis'
import type { OnboardingStage } from './questBuilder'

// ---------------------------------------------------------------------------
// Stage card
// ---------------------------------------------------------------------------

const stageRoutes: Record<string, string> = {
  explore: 'stage-explore',
  architecture: 'stage-architecture',
  knowledge: 'stage-knowledge',
  investigation: 'stage-investigation',
  predict: 'stage-predict',
  contribution: 'stage-contribution',
}

function StageCard({
  stage,
  completedCount,
  onStart,
}: {
  stage: OnboardingStage
  completedCount: number
  onStart: () => void
}) {
  const isAvailable = stage.status === 'available' || stage.status === 'in-progress'
  const isCompleted = stage.status === 'completed'
  const isLocked = stage.status === 'locked'

  return (
    <div className={`journey-stage-card ${isLocked ? 'is-locked' : ''} ${isCompleted ? 'is-complete' : ''}`}>
      <div className="journey-stage-num">{String(stage.index).padStart(2, '0')}</div>
      <div className="journey-stage-body">
        <div className="journey-stage-top">
          <StatusBadge
            tone={isCompleted ? 'complete' : isAvailable ? 'active' : 'neutral'}
          >
            {isCompleted ? 'Complete' : isAvailable ? 'Available' : 'Locked'}
          </StatusBadge>
          <span className="journey-stage-time">{stage.estimatedMinutes} min</span>
        </div>
        <h3>{stage.title}</h3>
        <p className="journey-stage-desc">{stage.description}</p>
        <div className="journey-stage-footer">
          <span className="analysis-muted">{stage.steps.length > 0 ? `${stage.steps.length} steps` : 'Coming soon'}</span>
          {isAvailable && (
            <Button variant={completedCount === 0 ? 'primary' : 'secondary'} onClick={onStart}>
              {stage.status === 'in-progress' ? 'Continue →' : 'Start →'}
            </Button>
          )}
          {isCompleted && (
            <Button variant="ghost" onClick={onStart}>Review →</Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Project overview strip
// ---------------------------------------------------------------------------

function ProjectOverview({ analysis }: { analysis: RepositoryAnalysis }) {
  const { projectSummary, technologies, architecture, importantFiles, learningObjectives } = analysis

  return (
    <Card className="project-overview-card">
      <div className="overview-header">
        <div>
          <span className="card-label">Project overview</span>
          <h2 className="overview-title">{projectSummary.name}</h2>
          {(projectSummary.description ?? projectSummary.purpose) && (
            <p className="overview-description">
              {projectSummary.description ?? projectSummary.purpose}
            </p>
          )}
        </div>
        {projectSummary.projectType && (
          <span className="analysis-tag overview-type-tag">{projectSummary.projectType}</span>
        )}
      </div>

      <div className="overview-stats">
        <div className="overview-stat">
          <span className="overview-stat-num">{technologies.length}</span>
          <span className="overview-stat-label">Technologies</span>
        </div>
        <div className="overview-stat">
          <span className="overview-stat-num">{architecture.length}</span>
          <span className="overview-stat-label">Components</span>
        </div>
        <div className="overview-stat">
          <span className="overview-stat-num">{importantFiles.length}</span>
          <span className="overview-stat-label">Key files</span>
        </div>
        <div className="overview-stat">
          <span className="overview-stat-num">{learningObjectives.length}</span>
          <span className="overview-stat-label">Objectives</span>
        </div>
      </div>

      {technologies.length > 0 && (
        <div className="overview-tech">
          <span className="card-label">Stack</span>
          <div className="overview-tech-tags">
            {technologies.slice(0, 8).map((tech) => (
              <span key={tech} className="analysis-tag">{tech}</span>
            ))}
            {technologies.length > 8 && (
              <span className="analysis-muted">+{technologies.length - 8} more</span>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Progress overview
// ---------------------------------------------------------------------------

function ProgressOverview({
  stages,
  repoName,
  isCacheHit,
}: {
  stages: OnboardingStage[]
  repoName: string
  isCacheHit: boolean
}) {
  const completed = stages.filter((s) => s.status === 'completed').length
  const total = stages.length
  const percent = Math.round((completed / total) * 100)

  return (
    <Card className="progress-card">
      <div>
        <span className="card-label">Journey progress</span>
        <strong>
          {completed} of {total} stages complete
        </strong>
      </div>
      <div className="progress-value">{percent}%</div>
      <ProgressBar value={percent} />
      <div className="progress-meta">
        <span>{repoName}</span>
        <span>{isCacheHit ? 'Analysis loaded from cache' : 'Analysis complete'}</span>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Pending / loading state
// ---------------------------------------------------------------------------

function DashboardPending({
  status,
  analysis,
  parsedRepo,
  error,
  isCacheHit,
}: {
  status: AnalysisStatus
  analysis: RepositoryAnalysis | null
  parsedRepo: ParsedRepository | null
  error: string | null
  isCacheHit: boolean
}) {
  return (
    <div>
      <AnalysisPanel
        status={status}
        analysis={analysis}
        parsedRepo={parsedRepo}
        error={error}
        isCacheHit={isCacheHit}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface OnboardingDashboardProps {
  status: AnalysisStatus
  analysis: RepositoryAnalysis | null
  parsedRepo: ParsedRepository | null
  error: string | null
  isCacheHit: boolean
  completedStageIds: string[]
  onNavigate: (route: string) => void
}

export function OnboardingDashboard({
  status,
  analysis,
  parsedRepo,
  error,
  isCacheHit,
  completedStageIds,
  onNavigate,
}: OnboardingDashboardProps) {
  // While analysis is in progress show the analysis panel
  if (!analysis) {
    return (
      <DashboardPending
        status={status}
        analysis={analysis}
        parsedRepo={parsedRepo}
        error={error}
        isCacheHit={isCacheHit}
      />
    )
  }

  // Build the stage journey from the analysis
  const baseStages = buildOnboardingJourney(analysis)
  const stages = baseStages.map((stage, idx) => {
    if (completedStageIds.includes(stage.id)) {
      return { ...stage, status: 'completed' as const }
    }
    // First non-completed stage is available; rest are locked
    const previousCompleted = idx === 0 || completedStageIds.includes(baseStages[idx - 1].id)
    if (previousCompleted) {
      return { ...stage, status: 'available' as const }
    }
    return stage
  })

  const repoName = analysis.projectSummary.name

  return (
    <div className="dashboard-layout">
      <ProgressOverview stages={stages} repoName={repoName} isCacheHit={isCacheHit} />

      <ProjectOverview analysis={analysis} />

      <div className="section-heading">
        <div>
          <p className="eyebrow">Your journey</p>
          <h2>Onboarding stages</h2>
        </div>
        <span className="muted">{stages.length} stages · ~{stages.reduce((a, s) => a + s.estimatedMinutes, 0)} min total</span>
      </div>

      <div className="journey-stages-list">
        {stages.map((stage) => (
          <StageCard
            key={stage.id}
            stage={stage}
            completedCount={completedStageIds.length}
            onStart={() => onNavigate(stageRoutes[stage.id])}
          />
        ))}
      </div>
    </div>
  )
}
