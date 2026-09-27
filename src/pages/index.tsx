import { Button, Card, PageHeader, StatusBadge } from '../components/ui'
import { RepositorySetup } from '../features/repository/RepositorySetup'
import { OnboardingDashboard } from '../features/onboarding/OnboardingDashboard'
import { StageShell } from '../features/onboarding/stages/StageShell'
import { Stage1Explore } from '../features/onboarding/stages/Stage1Explore'
import { Stage2Architecture } from '../features/onboarding/stages/Stage2Architecture'
import { Stage3Knowledge } from '../features/onboarding/stages/Stage3Knowledge'
import { Stage4Investigation } from '../features/onboarding/stages/Stage4Investigation'
import { Stage5Predict } from '../features/onboarding/stages/Stage5Predict'
import { Stage6Contribution } from '../features/onboarding/stages/Stage6Contribution'
import { buildOnboardingJourney } from '../features/onboarding/questBuilder'
import type { RepositoryService } from '../services/repository'
import type { UseRepositoryAnalysisResult } from '../hooks/useRepositoryAnalysis'
import type { RepositoryInput } from '../types'
import type { AllStageResults, ContributionStageResult } from '../features/onboarding/adaptiveProgress'

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

export function HomePage({ onNavigate }: { onNavigate: (route: string) => void }) {
  return (
    <div className="home-page">
      <div className="home-kicker"><span className="pulse" /> Developer onboarding, reimagined</div>
      <h1>Turn an unfamiliar<br /><em>codebase</em> into a map.</h1>
      <p className="home-lead">A focused path from first clone to first contribution. Explore the architecture, learn the patterns, and ship with confidence.</p>
      <Button onClick={() => onNavigate('setup')}>Start a new journey <span>→</span></Button>
      <div className="home-footer">
        <span>Built for curious developers</span>
        <span className="home-line" />
        <span>Private by default</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function SetupPage({ repositoryService, onReady }: { repositoryService?: RepositoryService; onReady: (input: RepositoryInput) => void }) {
  return (
    <div className="content-narrow">
      <PageHeader
        eyebrow="01 / Get oriented"
        title="Bring your repository."
        description="Connect a repository to create a tailored onboarding journey."
      />
      <RepositorySetup repositoryService={repositoryService} onReady={onReady} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Workspace — top-level route dispatcher
// ---------------------------------------------------------------------------

const STAGE_ROUTES = ['stage-explore', 'stage-architecture', 'stage-knowledge', 'stage-investigation', 'stage-predict', 'stage-contribution']

const STAGE_ROUTE_TO_ID: Record<string, string> = {
  'stage-explore': 'explore',
  'stage-architecture': 'architecture',
  'stage-knowledge': 'knowledge',
  'stage-investigation': 'investigation',
  'stage-predict': 'predict',
  'stage-contribution': 'contribution',
}

export function WorkspacePage({
  route,
  onNavigate,
  analysisState,
  completedStageIds,
  allStageResults,
  onStageComplete,
}: {
  route: string
  onNavigate: (route: string) => void
  analysisState?: UseRepositoryAnalysisResult
  completedStageIds?: string[]
  allStageResults?: AllStageResults
  onStageComplete?: (stageId: string, result?: ContributionStageResult) => void
}) {
  const isStageRoute = STAGE_ROUTES.includes(route)

  if (route === 'dashboard') {
    return (
      <div className="content-wide">
        <PageHeader
          eyebrow="02 / Your journey"
          title="Find your way around."
          description="A focused route through the systems and ideas that matter most."
          action={<StatusBadge tone="active">Dashboard</StatusBadge>}
        />
        <OnboardingDashboard
          status={analysisState?.status ?? 'idle'}
          analysis={analysisState?.analysis ?? null}
          parsedRepo={analysisState?.parsedRepo ?? null}
          error={analysisState?.error ?? null}
          isCacheHit={analysisState?.isCacheHit ?? false}
          completedStageIds={completedStageIds ?? []}
          onNavigate={onNavigate}
        />
      </div>
    )
  }

  if (isStageRoute && analysisState?.analysis) {
    const stageId = STAGE_ROUTE_TO_ID[route]
    const analysis = analysisState.analysis
    const STAGE_ORDER = ['explore', 'architecture', 'knowledge', 'investigation', 'predict', 'contribution']
    const completed = completedStageIds ?? []
    const stages = buildOnboardingJourney(analysis).map((s) => {
      if (completed.includes(s.id)) return { ...s, status: 'completed' as const }
      const idx = STAGE_ORDER.indexOf(s.id)
      const prevStageId = idx > 0 ? STAGE_ORDER[idx - 1] : null
      const prevDone = !prevStageId || completed.includes(prevStageId)
      return { ...s, status: prevDone ? 'available' as const : 'locked' as const }
    })

    const currentStage = stages.find((s) => s.id === stageId)

    if (!currentStage) {
      return <FallbackContent onNavigate={onNavigate} />
    }

    return (
      <div className="content-wide">
        <StageShell
          stages={stages}
          currentStageId={stageId}
          onNavigate={onNavigate}
        >
          {stageId === 'explore' && (
            <Stage1Explore
              analysis={analysis}
              stage={currentStage}
              onComplete={() => onStageComplete?.('explore')}
            />
          )}
          {stageId === 'architecture' && (
            <Stage2Architecture
              analysis={analysis}
              stage={currentStage}
              onComplete={() => onStageComplete?.('architecture')}
            />
          )}
          {stageId === 'knowledge' && (
            <Stage3Knowledge
              analysis={analysis}
              stage={currentStage}
              onComplete={() => onStageComplete?.('knowledge')}
            />
          )}
          {stageId === 'investigation' && (
            <Stage4Investigation
              analysis={analysis}
              stage={currentStage}
              onComplete={() => onStageComplete?.('investigation')}
            />
          )}
          {stageId === 'predict' && (
            <Stage5Predict
              analysis={analysis}
              stage={currentStage}
              onComplete={() => onStageComplete?.('predict')}
            />
          )}
          {stageId === 'contribution' && (
            <Stage6Contribution
              analysis={analysis}
              stage={currentStage}
              completedStageIds={completed}
              allStageResults={allStageResults ?? {}}
              onComplete={(result) => onStageComplete?.('contribution', result)}
              onNavigate={onNavigate}
            />
          )}
        </StageShell>
      </div>
    )
  }

  // Stage route but no analysis yet — send back to dashboard
  if (isStageRoute) {
    return (
      <div className="content-wide">
        <PageHeader
          eyebrow="Journey"
          title="Analysis in progress."
          description="Complete the repository analysis to begin your onboarding journey."
          action={<StatusBadge tone="neutral">Waiting</StatusBadge>}
        />
        <Card className="setup-empty">
          <p>The analysis is still running. Return to the dashboard to check progress.</p>
          <Button onClick={() => onNavigate('dashboard')}>Back to dashboard →</Button>
        </Card>
      </div>
    )
  }

  // Unknown route fallback
  return <FallbackContent onNavigate={onNavigate} />
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function FallbackContent({ onNavigate }: { onNavigate: (route: string) => void }) {
  return (
    <div className="content-narrow">
      <PageHeader
        eyebrow="Navigation"
        title="Nothing here."
        description="This page doesn't exist yet."
        action={<StatusBadge tone="neutral">404</StatusBadge>}
      />
      <Button onClick={() => onNavigate('home')}>Back to home →</Button>
    </div>
  )
}
