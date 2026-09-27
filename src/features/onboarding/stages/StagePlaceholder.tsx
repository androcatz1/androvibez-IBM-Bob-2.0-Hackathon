/**
 * StagePlaceholder
 *
 * Lightweight placeholder for stages that haven't been fully built yet
 * (Knowledge, Investigation, Predict a Change, First Contribution).
 * Shows the stage context and a teaser of what's coming.
 */

import { Button, Card, StatusBadge } from '../../../components/ui'
import type { RepositoryAnalysis } from '../../../types'
import type { OnboardingStage } from '../questBuilder'

interface Props {
  analysis: RepositoryAnalysis
  stage: OnboardingStage
  previousStageTitle?: string
  onComplete: () => void
  onBack: () => void
}

const STAGE_DETAILS: Record<string, { items: string[]; callout: string }> = {
  contribution: {
    items: [
      'A small, well-scoped improvement with clear acceptance criteria',
      'Suggested files to touch based on your exploration',
      'A verification plan using the project\'s own test commands',
      'A checklist to make your PR review-ready',
    ],
    callout: 'Finish the change prediction exercise to unlock your first contribution task.',
  },
}

export function StagePlaceholder({ analysis, stage, previousStageTitle, onComplete, onBack }: Props) {
  const details = STAGE_DETAILS[stage.id] ?? { items: [], callout: '' }

  // Surface relevant analysis data per stage
  const relatedContent = (() => {
    if (stage.id === 'knowledge' && analysis.learningObjectives.length > 0) {
      return (
        <div className="placeholder-preview">
          <p className="explore-sublabel">Learning objectives this stage will test</p>
          {analysis.learningObjectives.slice(0, 3).map((obj) => (
            <div key={obj.id} className="placeholder-objective">
              <strong>{obj.title}</strong>
              <span>{obj.description}</span>
            </div>
          ))}
        </div>
      )
    }
    if (stage.id === 'investigation' && analysis.businessRules.length > 0) {
      return (
        <div className="placeholder-preview">
          <p className="explore-sublabel">Domain rules you may need to investigate</p>
          {analysis.businessRules.slice(0, 2).map((rule) => (
            <div key={rule.id} className="placeholder-objective">
              <strong>{rule.title}</strong>
              <span>{rule.description}</span>
            </div>
          ))}
        </div>
      )
    }
    if (stage.id === 'predict' && analysis.architecture.length > 0) {
      return (
        <div className="placeholder-preview">
          <p className="explore-sublabel">Components you will reason about</p>
          <div className="explore-tag-grid">
            {analysis.architecture.map((comp) => (
              <span key={comp.id} className="explore-tech-tag">{comp.name}</span>
            ))}
          </div>
        </div>
      )
    }
    if (stage.id === 'contribution') {
      const task = analysis.quests.find((q) => q.type === 'contribution')
      if (task) {
        return (
          <div className="placeholder-preview">
            <p className="explore-sublabel">Suggested first task</p>
            <div className="placeholder-objective">
              <strong>{task.title}</strong>
              <span>{task.description}</span>
            </div>
          </div>
        )
      }
    }
    return null
  })()

  return (
    <div className="stage-content">
      <div className="stage-header">
        <div>
          <span className="card-label">{stage.tagline}</span>
          <h2>{stage.title}</h2>
          <p className="stage-description">{stage.description}</p>
        </div>
        <StatusBadge tone="neutral">Coming next</StatusBadge>
      </div>

      <Card className="placeholder-card">
        <div className="placeholder-coming-soon">
          <span className="placeholder-icon">🔒</span>
          <div>
            <h3>Almost there</h3>
            <p>
              {previousStageTitle
                ? `Complete "${previousStageTitle}" to unlock this stage.`
                : details.callout}
            </p>
          </div>
        </div>

        <div className="placeholder-preview-section">
          <p className="card-label">What you will do in this stage</p>
          <ul className="placeholder-list">
            {details.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        {relatedContent}

        <div className="placeholder-meta">
          <span className="analysis-muted">Estimated: {stage.estimatedMinutes} min</span>
          <span className="analysis-muted">·</span>
          <span className="analysis-muted">Stage {stage.index} of 6</span>
        </div>

        <div className="explore-step-actions">
          <Button variant="ghost" onClick={onBack}>
            ← Back
          </Button>
          <Button variant="secondary" onClick={onComplete} disabled>
            Unlock after previous stage →
          </Button>
        </div>
      </Card>
    </div>
  )
}
