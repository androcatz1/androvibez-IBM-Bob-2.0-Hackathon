/**
 * Stage5Predict — Predict a Change
 *
 * Presents a hypothetical codebase change derived from the RepositoryAnalysis.
 * Developer identifies affected files/components, dependencies, test needs, and risks.
 * Feedback evaluates the prediction against the analysis — no extra AI calls.
 */

import { useState, useMemo } from 'react'
import { Button, Card, StatusBadge } from '../../../components/ui'
import { buildChangeScenario } from '../challengeBuilder'
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

interface ChangeImpactSubmission {
  selectedComponentIds: string[]
  selectedDependencyIds: string[]
  testUpdatePlan: string
  risks: string
}

interface ChangeImpactFormProps {
  scenario: NonNullable<ReturnType<typeof buildChangeScenario>>
  analysis: RepositoryAnalysis
  onSubmit: (sub: ChangeImpactSubmission) => void
}

function ChangeImpactForm({ scenario, analysis, onSubmit }: ChangeImpactFormProps) {
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([])
  const [selectedDependencyIds, setSelectedDependencyIds] = useState<string[]>([])
  const [testUpdatePlan, setTestUpdatePlan] = useState('')
  const [risks, setRisks] = useState('')

  const canSubmit =
    selectedComponentIds.length > 0 &&
    testUpdatePlan.trim().length > 5 &&
    risks.trim().length > 5

  function toggleComponent(id: string) {
    setSelectedComponentIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  function toggleDependency(id: string) {
    setSelectedDependencyIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    )
  }

  return (
    <Card className="ci-form-card">
      <div className="ci-scenario">
        <span className="card-label">The proposed change</span>
        <h3>{scenario.title}</h3>
        <p className="ci-change-desc">{scenario.changeDescription}</p>
        <div className="ci-context">
          <span className="explore-sublabel">What to do</span>
          <p>{scenario.context}</p>
        </div>
      </div>

      {/* Step 1: Affected components */}
      <div className="inv-field">
        <label className="inv-field-label">
          <span className="explore-sublabel">Step 1 — Affected components</span>
          <span className="inv-field-hint">Which components will be affected by this change?</span>
        </label>
        <div className="inv-component-grid">
          {analysis.architecture.map((comp) => (
            <button
              key={comp.id}
              type="button"
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

      {/* Step 2: Dependencies affected */}
      {analysis.dependencies.length > 0 && (
        <div className="inv-field">
          <label className="inv-field-label">
            <span className="explore-sublabel">Step 2 — Dependencies affected</span>
            <span className="inv-field-hint">Select any dependencies that interact with this change (if any)</span>
          </label>
          <div className="ci-dep-grid">
            {analysis.dependencies.slice(0, 8).map((dep) => (
              <button
                key={dep.id}
                type="button"
                className={`ci-dep-btn ${selectedDependencyIds.includes(dep.id) ? 'is-selected' : ''}`}
                onClick={() => toggleDependency(dep.id)}
              >
                <strong>{dep.name}</strong>
                {dep.purpose && <span className="ci-dep-purpose">{dep.purpose}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Tests that may need updating */}
      <div className="inv-field">
        <label className="inv-field-label">
          <span className="explore-sublabel">Step 3 — Tests that may need updating</span>
          <span className="inv-field-hint">Which tests would need to change, and what commands would you run?</span>
        </label>
        <textarea
          className="inv-textarea"
          placeholder={`e.g. Tests for ${scenario.affectedComponents[0]?.name ?? 'the affected component'} need updating. Run: ${analysis.testing.commands?.[0] ?? 'your test command'}`}
          value={testUpdatePlan}
          onChange={(e) => setTestUpdatePlan(e.target.value)}
          rows={3}
        />
      </div>

      {/* Step 4: Potential risks */}
      <div className="inv-field">
        <label className="inv-field-label">
          <span className="explore-sublabel">Step 4 — Potential risks</span>
          <span className="inv-field-hint">What could go wrong? List at least one risk.</span>
        </label>
        <textarea
          className="inv-textarea"
          placeholder="e.g. Other components that depend on this one may break if the interface changes unexpectedly..."
          value={risks}
          onChange={(e) => setRisks(e.target.value)}
          rows={3}
        />
      </div>

      <div className="explore-step-actions">
        <Button type="button" onClick={() => onSubmit({ selectedComponentIds, selectedDependencyIds, testUpdatePlan, risks })} disabled={!canSubmit}>
          Submit prediction →
        </Button>
      </div>
      {!canSubmit && (
        <p className="analysis-muted">
          Select at least one component, then write a test plan and risk assessment with more than 5 characters each.
        </p>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Feedback view
// ---------------------------------------------------------------------------

interface ChangeImpactFeedbackProps {
  scenario: NonNullable<ReturnType<typeof buildChangeScenario>>
  submission: ChangeImpactSubmission
  analysis: RepositoryAnalysis
  onComplete: () => void
}

function ChangeImpactFeedback({ scenario, submission, analysis, onComplete }: ChangeImpactFeedbackProps) {
  const expectedIds = scenario.affectedComponents.map((c) => c.id)
  const selectedCorrect = submission.selectedComponentIds.filter((id) => expectedIds.includes(id))
  const missed = expectedIds.filter((id) => !submission.selectedComponentIds.includes(id))
  const extra = submission.selectedComponentIds.filter((id) => !expectedIds.includes(id))

  const score = selectedCorrect.length - (extra.length * 0.5)
  const passed = score > 0 && submission.risks.trim().length > 10

  return (
    <Card className="ci-feedback-card">
      <div className="ci-feedback-header">
        <div>
          <span className="card-label">Change impact feedback</span>
          <h3>{passed ? 'Strong systems thinking' : 'Good start — see the full picture below'}</h3>
        </div>
        <StatusBadge tone={passed ? 'complete' : 'neutral'}>
          {passed ? 'Passed' : 'Review'}
        </StatusBadge>
      </div>

      {/* Component accuracy */}
      <div className="ci-feedback-section">
        <span className="explore-sublabel">Component impact accuracy</span>
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
              <span>Also affected (missed): {missed.map((id) =>
                analysis.architecture.find((c) => c.id === id)?.name ?? id
              ).join(', ')}</span>
            </div>
          )}
          {extra.length > 0 && (
            <div className="inv-fb-row inv-fb-wrong">
              <span className="inv-fb-icon">?</span>
              <span>Likely not affected: {extra.map((id) =>
                analysis.architecture.find((c) => c.id === id)?.name ?? id
              ).join(', ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Expected impact */}
      <div className="ci-feedback-section">
        <span className="explore-sublabel">Full impact picture</span>
        <ul className="inv-expected-list">
          {scenario.expectedImpactPoints.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      </div>

      {/* Risks from analysis */}
      <div className="ci-feedback-section">
        <span className="explore-sublabel">Identified risks</span>
        <ul className="inv-expected-list">
          {scenario.risks.map((risk, i) => (
            <li key={i}>{risk}</li>
          ))}
        </ul>
        <div className="ci-your-risks">
          <span className="inv-hint-label">Your risk assessment</span>
          <p className="analysis-muted">{submission.risks}</p>
        </div>
      </div>

      {/* Testing guidance */}
      <div className="ci-feedback-section">
        <span className="explore-sublabel">Testing guidance from the analysis</span>
        <ul className="inv-expected-list">
          {scenario.testingNotes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
        <div className="ci-your-risks">
          <span className="inv-hint-label">Your test update plan</span>
          <p className="analysis-muted">{submission.testUpdatePlan}</p>
        </div>
      </div>

      {/* Affected files */}
      {scenario.affectedFiles.length > 0 && (
        <div className="ci-feedback-section">
          <span className="explore-sublabel">Files likely affected</span>
          <div className="explore-file-group">
            {scenario.affectedFiles.map((f) => (
              <div key={f.id} className="explore-file-item">
                <code>{f.path}</code>
                {f.role && <span className="explore-file-role">{f.role}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="explore-step-actions">
        <Button onClick={onComplete}>
          Continue to First Contribution →
        </Button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Stage5Predict({ analysis, stage, onComplete }: Props) {
  const scenario = useMemo(() => buildChangeScenario(analysis), [analysis])
  const [submission, setSubmission] = useState<ChangeImpactSubmission | null>(null)

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
          <p className="explore-empty">Not enough architecture data to generate a change scenario. Continue to the next stage.</p>
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
            A change has been proposed to the codebase. Before writing a single line of code,
            use your architecture knowledge to predict the ripple effects: which components are
            touched, what tests need updating, and what could go wrong. Systems thinkers
            predict before they act.
          </p>
        </Card>
      )}

      {!submission ? (
        <ChangeImpactForm
          scenario={scenario}
          analysis={analysis}
          onSubmit={setSubmission}
        />
      ) : (
        <ChangeImpactFeedback
          scenario={scenario}
          submission={submission}
          analysis={analysis}
          onComplete={onComplete}
        />
      )}
    </div>
  )
}
