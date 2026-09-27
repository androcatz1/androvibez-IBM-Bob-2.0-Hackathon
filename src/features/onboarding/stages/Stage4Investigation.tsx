/**
 * Stage4Investigation — Investigate a Problem
 *
 * Presents a realistic problem scenario derived from the RepositoryAnalysis.
 * Developer identifies relevant files, execution path, likely cause, and reasoning.
 * Feedback is based purely on the existing analysis — no extra AI calls.
 */

import { useState, useMemo } from 'react'
import { Button, Card, StatusBadge } from '../../../components/ui'
import { buildInvestigationScenario } from '../challengeBuilder'
import type { RepositoryAnalysis } from '../../../types'
import type { OnboardingStage } from '../questBuilder'

interface Props {
  analysis: RepositoryAnalysis
  stage: OnboardingStage
  onComplete: () => void
}

// ---------------------------------------------------------------------------
// Submission form
// ---------------------------------------------------------------------------

interface InvestigationFormProps {
  scenario: NonNullable<ReturnType<typeof buildInvestigationScenario>>
  analysis: RepositoryAnalysis
  onSubmit: (submission: InvestigationSubmission) => void
}

interface InvestigationSubmission {
  selectedComponentIds: string[]
  executionPath: string
  likelyCause: string
  reasoning: string
}

function InvestigationForm({ scenario, analysis, onSubmit }: InvestigationFormProps) {
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([])
  const [executionPath, setExecutionPath] = useState('')
  const [likelyCause, setLikelyCause] = useState('')
  const [reasoning, setReasoning] = useState('')
  const [hintIndex, setHintIndex] = useState(-1)

  const canSubmit =
    selectedComponentIds.length > 0 &&
    executionPath.trim().length > 5 &&
    likelyCause.trim().length > 5 &&
    reasoning.trim().length > 10

  function toggleComponent(id: string) {
    setSelectedComponentIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  function handleSubmit() {
    onSubmit({ selectedComponentIds, executionPath, likelyCause, reasoning })
  }

  return (
    <Card className="inv-form-card">
      <div className="inv-scenario">
        <span className="card-label">The scenario</span>
        <h3>{scenario.title}</h3>
        <p className="inv-prompt">{scenario.prompt}</p>
        <div className="inv-context">
          <span className="explore-sublabel">Context</span>
          <p>{scenario.context}</p>
        </div>
      </div>

      {/* Step 1: Relevant components */}
      <div className="inv-field">
        <label className="inv-field-label">
          <span className="explore-sublabel">Step 1 — Relevant components</span>
          <span className="inv-field-hint">Select all components likely involved in this problem</span>
        </label>
        <div className="inv-component-grid">
          {analysis.architecture.map((comp) => (
            <button
              key={comp.id}
              className={`inv-comp-btn ${selectedComponentIds.includes(comp.id) ? 'is-selected' : ''}`}
              onClick={() => toggleComponent(comp.id)}
            >
              <span className="inv-comp-type">{comp.type}</span>
              <strong>{comp.name}</strong>
              {comp.responsibilities[0] && (
                <span className="inv-comp-resp">{comp.responsibilities[0]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Execution path */}
      <div className="inv-field">
        <label className="inv-field-label">
          <span className="explore-sublabel">Step 2 — Likely execution path</span>
          <span className="inv-field-hint">Describe the path a request takes (e.g. "A → B → C")</span>
        </label>
        <textarea
          className="inv-textarea"
          placeholder="e.g. Request enters via ComponentA → passes through ComponentB → reaches ComponentC where the issue occurs"
          value={executionPath}
          onChange={(e) => setExecutionPath(e.target.value)}
          rows={3}
        />
      </div>

      {/* Step 3: Likely cause */}
      <div className="inv-field">
        <label className="inv-field-label">
          <span className="explore-sublabel">Step 3 — Possible cause</span>
          <span className="inv-field-hint">What do you think is going wrong and why?</span>
        </label>
        <textarea
          className="inv-textarea"
          placeholder="e.g. The issue is likely in the domain layer because it is responsible for enforcing business rules..."
          value={likelyCause}
          onChange={(e) => setLikelyCause(e.target.value)}
          rows={3}
        />
      </div>

      {/* Step 4: Evidence / reasoning */}
      <div className="inv-field">
        <label className="inv-field-label">
          <span className="explore-sublabel">Step 4 — Evidence &amp; reasoning</span>
          <span className="inv-field-hint">What from the codebase analysis supports your conclusion?</span>
        </label>
        <textarea
          className="inv-textarea"
          placeholder="e.g. The analysis shows ComponentX is responsible for validation, and the business rule states..."
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          rows={4}
        />
      </div>

      {/* Hints */}
      <div className="inv-hints">
        {hintIndex >= 0 && scenario.hints.slice(0, hintIndex + 1).map((hint, i) => (
          <div key={i} className="inv-hint">
            <span className="inv-hint-label">Hint {i + 1}</span>
            <span>{hint}</span>
          </div>
        ))}
        {hintIndex < scenario.hints.length - 1 && (
          <button
            className="inv-hint-btn"
            onClick={() => setHintIndex((h) => h + 1)}
          >
            {hintIndex === -1 ? 'Show a hint' : 'Show next hint'}
          </button>
        )}
      </div>

      <div className="explore-step-actions">
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          Submit investigation →
        </Button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Feedback view
// ---------------------------------------------------------------------------

interface InvestigationFeedbackProps {
  scenario: NonNullable<ReturnType<typeof buildInvestigationScenario>>
  submission: InvestigationSubmission
  analysis: RepositoryAnalysis
  onComplete: () => void
}

function InvestigationFeedback({ scenario, submission, analysis, onComplete }: InvestigationFeedbackProps) {
  const targetIds = scenario.targetComponents.map((c) => c.id)
  const selectedCorrect = submission.selectedComponentIds.filter((id) => targetIds.includes(id))
  const selectedWrong = submission.selectedComponentIds.filter((id) => !targetIds.includes(id))
  const missed = targetIds.filter((id) => !submission.selectedComponentIds.includes(id))

  const componentScore = selectedCorrect.length - selectedWrong.length
  const passed = componentScore > 0 && submission.reasoning.trim().length > 20

  return (
    <Card className="inv-feedback-card">
      <div className="inv-feedback-header">
        <div>
          <span className="card-label">Investigation feedback</span>
          <h3>{passed ? 'Good investigation' : 'Partial credit — see below'}</h3>
        </div>
        <StatusBadge tone={passed ? 'complete' : 'neutral'}>
          {passed ? 'On track' : 'Review'}
        </StatusBadge>
      </div>

      {/* Component identification */}
      <div className="inv-feedback-section">
        <span className="explore-sublabel">Component identification</span>
        <div className="inv-feedback-comps">
          {selectedCorrect.length > 0 && (
            <div className="inv-fb-row inv-fb-correct">
              <span className="inv-fb-icon">✓</span>
              <span>Correctly identified: {selectedCorrect.map((id) =>
                analysis.architecture.find((c) => c.id === id)?.name ?? id
              ).join(', ')}</span>
            </div>
          )}
          {missed.length > 0 && (
            <div className="inv-fb-row inv-fb-missed">
              <span className="inv-fb-icon">○</span>
              <span>Missed: {missed.map((id) =>
                analysis.architecture.find((c) => c.id === id)?.name ?? id
              ).join(', ')}</span>
            </div>
          )}
          {selectedWrong.length > 0 && (
            <div className="inv-fb-row inv-fb-wrong">
              <span className="inv-fb-icon">✗</span>
              <span>Not likely involved: {selectedWrong.map((id) =>
                analysis.architecture.find((c) => c.id === id)?.name ?? id
              ).join(', ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Model answer */}
      <div className="inv-feedback-section">
        <span className="explore-sublabel">Expected findings</span>
        <ul className="inv-expected-list">
          {scenario.expectedFindings.map((finding, i) => (
            <li key={i}>{finding}</li>
          ))}
        </ul>
      </div>

      {/* Related rule */}
      {scenario.relatedRule && (
        <div className="inv-feedback-section">
          <span className="explore-sublabel">Relevant business rule</span>
          <div className="arch-rule">
            <strong>{scenario.relatedRule.title}</strong>
            <p>{scenario.relatedRule.description}</p>
          </div>
        </div>
      )}

      {/* Target files */}
      {scenario.targetFiles.length > 0 && (
        <div className="inv-feedback-section">
          <span className="explore-sublabel">Key files to examine</span>
          <div className="explore-file-group">
            {scenario.targetFiles.map((f) => (
              <div key={f.id} className="explore-file-item">
                <code>{f.path}</code>
                {f.role && <span className="explore-file-role">{f.role}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Your submission summary */}
      <div className="inv-feedback-section">
        <span className="explore-sublabel">Your reasoning</span>
        <div className="inv-submission-review">
          <p className="analysis-muted">{submission.reasoning}</p>
        </div>
      </div>

      <div className="explore-step-actions">
        <Button onClick={onComplete}>
          Continue to Change Impact →
        </Button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Stage4Investigation({ analysis, stage, onComplete }: Props) {
  const scenario = useMemo(() => buildInvestigationScenario(analysis), [analysis])
  const [submission, setSubmission] = useState<InvestigationSubmission | null>(null)

  if (!scenario) {
    return (
      <div className="stage-content">
        <div className="stage-header">
          <div>
            <span className="card-label">{stage.tagline}</span>
            <h2>{stage.title}</h2>
          </div>
          <StatusBadge tone="neutral">Skipped</StatusBadge>
        </div>
        <Card>
          <p className="explore-empty">Not enough architecture data to create an investigation scenario. Continue to the next stage.</p>
          <div className="explore-step-actions">
            <Button onClick={onComplete}>Continue →</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="stage-content">
      <div className="stage-header">
        <div>
          <span className="card-label">{stage.tagline}</span>
          <h2>{stage.title}</h2>
          <p className="stage-description">{stage.description}</p>
        </div>
        <StatusBadge tone="active">In progress</StatusBadge>
      </div>

      {/* Instruction strip */}
      {!submission && (
        <Card className="inv-instructions">
          <span className="card-label">How this works</span>
          <p className="analysis-muted">
            You've been given a realistic problem report. Using only what you've already learned
            about this codebase, identify the relevant components, trace the execution path,
            and explain your reasoning. There are no trick questions — everything you need
            is in the architecture map you built.
          </p>
        </Card>
      )}

      {!submission ? (
        <InvestigationForm
          scenario={scenario}
          analysis={analysis}
          onSubmit={setSubmission}
        />
      ) : (
        <InvestigationFeedback
          scenario={scenario}
          submission={submission}
          analysis={analysis}
          onComplete={onComplete}
        />
      )}
    </div>
  )
}
