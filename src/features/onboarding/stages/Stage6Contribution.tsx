/**
 * Stage6Contribution — First Contribution
 *
 * Presents a realistic development task derived from the RepositoryAnalysis.
 * The developer plans (not codes) an approach across 5 questions:
 *   1. Which files to investigate
 *   2. Which components are involved
 *   3. What existing behaviour they need to understand
 *   4. What changes they would make
 *   5. What tests they would add/modify
 *
 * Feedback evaluates their plan against the analysis.
 * Concludes with a "Contribution Ready" screen powered by computeAdaptiveProgress.
 *
 * No extra AI calls. Zero hard-coded project logic.
 */

import { useState, useMemo } from 'react'
import { Button, Card, StatusBadge, ProgressBar } from '../../../components/ui'
import { buildContributionTask } from '../challengeBuilder'
import { computeAdaptiveProgress } from '../adaptiveProgress'
import type { RepositoryAnalysis } from '../../../types'
import type { OnboardingStage } from '../questBuilder'
import type {
  AllStageResults,
  ContributionStageResult,
  AdaptiveProgressResult,
} from '../adaptiveProgress'

interface Props {
  analysis: RepositoryAnalysis
  stage: OnboardingStage
  completedStageIds: string[]
  allStageResults: AllStageResults
  onComplete: (result: ContributionStageResult) => void
  onNavigate: (route: string) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function qualityOf(text: string, minGood: number = 60): 'good' | 'partial' | 'minimal' {
  const len = text.trim().length
  if (len >= minGood) return 'good'
  if (len >= 20) return 'partial'
  return 'minimal'
}

// ---------------------------------------------------------------------------
// Contribution Form
// ---------------------------------------------------------------------------

interface ContributionSubmission {
  filesText: string
  selectedComponentIds: string[]
  existingBehaviour: string
  proposedChanges: string
  testsText: string
}

interface ContributionFormProps {
  task: NonNullable<ReturnType<typeof buildContributionTask>>
  analysis: RepositoryAnalysis
  onSubmit: (sub: ContributionSubmission) => void
}

function ContributionForm({ task, analysis, onSubmit }: ContributionFormProps) {
  const [filesText, setFilesText] = useState('')
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([])
  const [existingBehaviour, setExistingBehaviour] = useState('')
  const [proposedChanges, setProposedChanges] = useState('')
  const [testsText, setTestsText] = useState('')

  const canSubmit =
    filesText.trim().length > 5 &&
    selectedComponentIds.length > 0 &&
    existingBehaviour.trim().length > 10 &&
    proposedChanges.trim().length > 10 &&
    testsText.trim().length > 5

  function toggleComponent(id: string) {
    setSelectedComponentIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  return (
    <Card className="ci-form-card">
      {/* Task brief */}
      <div className="contrib-task-brief">
        <span className="card-label">Your contribution task</span>
        <h3>{task.title}</h3>
        <p className="ci-change-desc">{task.description}</p>
        <div className="ci-context">
          <span className="explore-sublabel">Target behaviour</span>
          <p>Extend: <strong>{task.targetBehaviour}</strong></p>
        </div>
      </div>

      {/* Reference: acceptance criteria */}
      <div className="contrib-criteria">
        <span className="explore-sublabel">Acceptance criteria</span>
        <ul className="inv-expected-list">
          {task.acceptanceCriteria.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </div>

      {/* Q1: Files to investigate */}
      <div className="inv-field">
        <label className="inv-field-label">
          <span className="explore-sublabel">1 — Which files would you investigate first?</span>
          <span className="inv-field-hint">List file paths or patterns you would read before making any change</span>
        </label>
        {task.filesToInvestigate.length > 0 && (
          <div className="contrib-file-hints">
            <span className="inv-hint-label">Files from the analysis you might start with</span>
            <div className="explore-file-group contrib-reference-files">
              {task.filesToInvestigate.map((f, i) => (
                <div key={i} className="explore-file-item">
                  <code>{f.path}</code>
                  <span className="explore-file-role">{f.relevance}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <textarea
          className="inv-textarea"
          placeholder={`e.g. ${task.filesToInvestigate[0]?.path ?? 'src/components/...'}  — to understand how the current feature works`}
          value={filesText}
          onChange={(e) => setFilesText(e.target.value)}
          rows={3}
        />
      </div>

      {/* Q2: Components involved */}
      <div className="inv-field">
        <label className="inv-field-label">
          <span className="explore-sublabel">2 — Which components are involved?</span>
          <span className="inv-field-hint">Select every component your change will touch or call</span>
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

      {/* Q3: Existing behaviour */}
      <div className="inv-field">
        <label className="inv-field-label">
          <span className="explore-sublabel">3 — What existing behaviour must you understand?</span>
          <span className="inv-field-hint">Describe what the code already does that your change builds on or depends on</span>
        </label>
        <textarea
          className="inv-textarea"
          placeholder={`e.g. ${task.existingBehaviourPoints[0] ?? 'The component currently handles...'}`}
          value={existingBehaviour}
          onChange={(e) => setExistingBehaviour(e.target.value)}
          rows={4}
        />
      </div>

      {/* Q4: Proposed changes */}
      <div className="inv-field">
        <label className="inv-field-label">
          <span className="explore-sublabel">4 — What changes would you make?</span>
          <span className="inv-field-hint">Describe your implementation plan at a high level — no production code needed</span>
        </label>
        <textarea
          className="inv-textarea"
          placeholder={`e.g. ${task.proposedChanges[0] ?? 'I would extend...'}`}
          value={proposedChanges}
          onChange={(e) => setProposedChanges(e.target.value)}
          rows={4}
        />
      </div>

      {/* Q5: Tests */}
      <div className="inv-field">
        <label className="inv-field-label">
          <span className="explore-sublabel">5 — What tests would you add or modify?</span>
          <span className="inv-field-hint">Name the test cases and the command you would run to verify the change</span>
        </label>
        <textarea
          className="inv-textarea"
          placeholder={`e.g. ${task.testingSuggestions[0] ?? 'Add a unit test for the new behaviour. Run: npm test'}`}
          value={testsText}
          onChange={(e) => setTestsText(e.target.value)}
          rows={3}
        />
      </div>

      <div className="explore-step-actions">
        <Button onClick={() => onSubmit({ filesText, selectedComponentIds, existingBehaviour, proposedChanges, testsText })} disabled={!canSubmit}>
          Submit plan →
        </Button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Contribution Feedback
// ---------------------------------------------------------------------------

interface ContributionFeedbackProps {
  task: NonNullable<ReturnType<typeof buildContributionTask>>
  submission: ContributionSubmission
  analysis: RepositoryAnalysis
  stageResult: ContributionStageResult
  onContinue: () => void
}

function ContributionFeedback({ task, submission, analysis, stageResult, onContinue }: ContributionFeedbackProps) {
  const targetIds = task.targetComponents.map((c) => c.id)
  const correct = submission.selectedComponentIds.filter((id) => targetIds.includes(id))
  const missed = targetIds.filter((id) => !submission.selectedComponentIds.includes(id))
  const extra = submission.selectedComponentIds.filter((id) => !targetIds.includes(id))

  const overallScore = Math.round(
    (stageResult.filesIdentified / Math.max(stageResult.suggestedFilesTotal, 1)) * 20 +
    (stageResult.correctComponentCount / Math.max(stageResult.totalTargetComponents, 1)) * 30 +
    (stageResult.changesQuality === 'good' ? 25 : stageResult.changesQuality === 'partial' ? 13 : 0) +
    (stageResult.testsQuality === 'good' ? 25 : stageResult.testsQuality === 'partial' ? 13 : 0)
  )
  const passed = overallScore >= 55

  return (
    <Card className="ci-feedback-card">
      <div className="ci-feedback-header">
        <div>
          <span className="card-label">Contribution plan feedback</span>
          <h3>{passed ? 'Well-planned contribution' : 'Good start — review the full picture below'}</h3>
        </div>
        <StatusBadge tone={passed ? 'complete' : 'neutral'}>
          {passed ? 'Ready' : 'Review'}
        </StatusBadge>
      </div>

      {/* Component identification */}
      <div className="ci-feedback-section">
        <span className="explore-sublabel">Repository understanding — component identification</span>
        <div className="inv-feedback-comps">
          {correct.length > 0 && (
            <div className="inv-fb-row inv-fb-correct">
              <span className="inv-fb-icon">✓</span>
              <span>Correctly identified: {correct.map((id) =>
                analysis.architecture.find((c) => c.id === id)?.name ?? id
              ).join(', ')}</span>
            </div>
          )}
          {missed.length > 0 && (
            <div className="inv-fb-row inv-fb-missed">
              <span className="inv-fb-icon">○</span>
              <span>Also relevant (missed): {missed.map((id) =>
                analysis.architecture.find((c) => c.id === id)?.name ?? id
              ).join(', ')}</span>
            </div>
          )}
          {extra.length > 0 && (
            <div className="inv-fb-row inv-fb-wrong">
              <span className="inv-fb-icon">?</span>
              <span>Likely not involved: {extra.map((id) =>
                analysis.architecture.find((c) => c.id === id)?.name ?? id
              ).join(', ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Existing behaviour reference */}
      <div className="ci-feedback-section">
        <span className="explore-sublabel">Existing behaviour to understand</span>
        <ul className="inv-expected-list">
          {task.existingBehaviourPoints.map((point, i) => <li key={i}>{point}</li>)}
        </ul>
        <div className="ci-your-risks">
          <span className="inv-hint-label">Your answer</span>
          <p className="analysis-muted">{submission.existingBehaviour}</p>
        </div>
      </div>

      {/* Proposed changes reference */}
      <div className="ci-feedback-section">
        <span className="explore-sublabel">Suggested change approach</span>
        <ul className="inv-expected-list">
          {task.proposedChanges.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
        <div className="ci-your-risks">
          <span className="inv-hint-label">Your plan</span>
          <p className="analysis-muted">{submission.proposedChanges}</p>
        </div>
      </div>

      {/* Testing */}
      <div className="ci-feedback-section">
        <span className="explore-sublabel">Testing strategy</span>
        <ul className="inv-expected-list">
          {task.testingSuggestions.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
        <div className="ci-your-risks">
          <span className="inv-hint-label">Your test plan</span>
          <p className="analysis-muted">{submission.testsText}</p>
        </div>
      </div>

      <div className="explore-step-actions">
        <Button onClick={onContinue}>
          See your results →
        </Button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Contribution Ready screen
// ---------------------------------------------------------------------------

interface ContributionReadyProps {
  progress: AdaptiveProgressResult
  completedStageIds: string[]
  analysis: RepositoryAnalysis
  onDashboard: () => void
}

const STAGE_LABELS: Record<string, string> = {
  explore: 'Explore the Codebase',
  architecture: 'Understand the Architecture',
  knowledge: 'Prove Your Knowledge',
  investigation: 'Investigate a Problem',
  predict: 'Predict a Change',
  contribution: 'First Contribution',
}

function ContributionReady({ progress, completedStageIds, analysis, onDashboard }: ContributionReadyProps) {
  const allSix = completedStageIds.length >= 6
  const { stageScores, overallPercent, conceptsUnderstood, gaps, recommendations } = progress

  return (
    <div className="contrib-ready">
      {/* Hero header */}
      <div className="contrib-ready-hero">
        <div className="contrib-ready-badge">
          {allSix ? '✦' : '◈'}
        </div>
        <div>
          <span className="card-label">{allSix ? 'Journey complete' : 'Stage complete'}</span>
          <h2 className="contrib-ready-title">
            {allSix ? 'Contribution Ready' : 'First Contribution done'}
          </h2>
          <p className="stage-description">
            You have navigated {analysis.projectSummary.name} from first look to a planned contribution.
          </p>
        </div>
      </div>

      {/* Overall progress */}
      <Card className="contrib-ready-card">
        <div className="contrib-overall-row">
          <div>
            <span className="card-label">Overall onboarding progress</span>
            <p className="contrib-overall-pct">{overallPercent}%</p>
          </div>
          <StatusBadge tone={overallPercent >= 70 ? 'complete' : overallPercent >= 50 ? 'active' : 'neutral'}>
            {overallPercent >= 70 ? 'Contribution ready' : overallPercent >= 50 ? 'On track' : 'Keep learning'}
          </StatusBadge>
        </div>
        <ProgressBar value={overallPercent} />
      </Card>

      {/* Completed quests */}
      <Card className="contrib-ready-card">
        <span className="card-label">Completed quests</span>
        <div className="contrib-quest-list">
          {completedStageIds.map((id) => {
            const displayScore = id === 'predict' ? (stageScores.changeImpact ?? 100) : (stageScores[id] ?? 100)
            return (
              <div key={id} className="contrib-quest-row">
                <span className="contrib-quest-check">✓</span>
                <span className="contrib-quest-name">{STAGE_LABELS[id] ?? id}</span>
                <span className={`contrib-quest-score ${displayScore >= 70 ? 'is-strong' : displayScore >= 50 ? 'is-ok' : 'is-weak'}`}>
                  {displayScore}%
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Concepts understood */}
      {conceptsUnderstood.length > 0 && (
        <Card className="contrib-ready-card">
          <span className="card-label">Concepts understood</span>
          <div className="contrib-concepts-list">
            {conceptsUnderstood.map((c, i) => (
              <div key={i} className="contrib-concept-row">
                <span className="contrib-concept-dot" />
                <span>{c}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Knowledge gaps */}
      {gaps.length > 0 ? (
        <Card className="contrib-ready-card">
          <span className="card-label">Knowledge gaps</span>
          <div className="contrib-gaps-list">
            {gaps.map((gap) => (
              <div key={gap.id} className={`contrib-gap-row contrib-gap-${gap.severity}`}>
                <div className="contrib-gap-header">
                  <strong>{gap.label}</strong>
                  <span className={`contrib-gap-badge contrib-gap-badge-${gap.severity}`}>
                    {gap.severity}
                  </span>
                </div>
                <p className="analysis-muted">{gap.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="contrib-ready-card contrib-no-gaps">
          <span className="card-label">Knowledge gaps</span>
          <p className="analysis-muted">No significant gaps detected — strong across all stages.</p>
        </Card>
      )}

      {/* Recommended next steps */}
      <Card className="contrib-ready-card">
        <span className="card-label">Recommended next steps</span>
        <ol className="contrib-recs-list">
          {recommendations.map((rec, i) => (
            <li key={i}>{rec}</li>
          ))}
        </ol>
      </Card>

      <div className="contrib-ready-footer">
        <Button variant="secondary" onClick={onDashboard}>
          Back to dashboard →
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Stage6Contribution({ analysis, stage, completedStageIds, allStageResults, onComplete, onNavigate }: Props) {
  const task = useMemo(() => buildContributionTask(analysis), [analysis])
  const [submission, setSubmission] = useState<ContributionSubmission | null>(null)
  const [stageResult, setStageResult] = useState<ContributionStageResult | null>(null)
  const [showReady, setShowReady] = useState(false)

  // Called when the developer submits their plan — evaluate and store
  function handleSubmit(sub: ContributionSubmission) {
    if (!task) return
    const targetIds = task.targetComponents.map((c) => c.id)
    const correctComponentCount = sub.selectedComponentIds.filter((id) => targetIds.includes(id)).length

    // Count how many suggested files the developer mentioned by path or name
    const filesLower = sub.filesText.toLowerCase()
    const filesIdentified = task.filesToInvestigate.filter((f) =>
      filesLower.includes(f.path.toLowerCase().split('/').pop()?.split('.')[0] ?? '') ||
      filesLower.includes(f.path.toLowerCase())
    ).length

    const result: ContributionStageResult = {
      filesIdentified,
      suggestedFilesTotal: task.filesToInvestigate.length,
      correctComponentCount,
      totalTargetComponents: targetIds.length,
      changesQuality: qualityOf(sub.proposedChanges, 60),
      testsQuality: qualityOf(sub.testsText, 40),
    }
    setStageResult(result)
    setSubmission(sub)
  }

  function handleFeedbackContinue() {
    if (stageResult) {
      onComplete(stageResult)
      setShowReady(true)
    }
  }

  // Contribution Ready screen (shown after onComplete has been called)
  if (showReady && stageResult) {
    const finalCompleted = completedStageIds.includes('contribution')
      ? completedStageIds
      : [...completedStageIds, 'contribution']
    const allResultsWithContrib: AllStageResults = { ...allStageResults, contribution: stageResult }
    const progress = computeAdaptiveProgress(finalCompleted, allResultsWithContrib, analysis)
    return <ContributionReady progress={progress} completedStageIds={finalCompleted} analysis={analysis} onDashboard={() => onNavigate('dashboard')} />
  }

  if (!task) {
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
          <p className="explore-empty">Not enough architecture data to generate a contribution task. Continue to complete the journey.</p>
          <div className="explore-step-actions">
            <Button onClick={() => { onComplete({ filesIdentified: 0, suggestedFilesTotal: 0, correctComponentCount: 0, totalTargetComponents: 0, changesQuality: 'minimal', testsQuality: 'minimal' }); setShowReady(true) }}>
              Complete journey →
            </Button>
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
            A real task has been generated from the codebase analysis. You don't need to write
            production code — instead, plan your approach: which files you would read, which
            components you would touch, what already exists, what you would change, and what
            tests you would write. A good plan is the hardest part.
          </p>
        </Card>
      )}

      {!submission ? (
        <ContributionForm task={task} analysis={analysis} onSubmit={handleSubmit} />
      ) : stageResult && !showReady ? (
        <ContributionFeedback
          task={task}
          submission={submission}
          analysis={analysis}
          stageResult={stageResult}
          onContinue={handleFeedbackContinue}
        />
      ) : null}
    </div>
  )
}
