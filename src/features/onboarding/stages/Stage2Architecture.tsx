/**
 * Stage2Architecture — Understand the Architecture
 *
 * An interactive exploration of how components relate, what the key concepts are,
 * and how data flows through the system.
 * All data comes from the existing RepositoryAnalysis.
 */

import { useState } from 'react'
import { Button, Card, StatusBadge } from '../../../components/ui'
import type { RepositoryAnalysis, ArchitectureComponent } from '../../../types'
import type { OnboardingStage } from '../questBuilder'

interface Props {
  analysis: RepositoryAnalysis
  stage: OnboardingStage
  onComplete: () => void
}

// ---------------------------------------------------------------------------
// Component relationship visualisation
// ---------------------------------------------------------------------------

function ComponentNode({
  comp,
  isSelected,
  onClick,
}: {
  comp: ArchitectureComponent
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      className={`arch-node ${isSelected ? 'is-selected' : ''}`}
      onClick={onClick}
    >
      <span className="arch-node-type">{comp.type}</span>
      <strong className="arch-node-name">{comp.name}</strong>
      <span className="arch-node-count">{comp.responsibilities.length} responsibilities</span>
    </button>
  )
}

function ComponentDetail({ comp, allComponents }: { comp: ArchitectureComponent; allComponents: ArchitectureComponent[] }) {
  const dependencies = (comp.dependsOnComponentIds ?? [])
    .map((id) => allComponents.find((c) => c.id === id))
    .filter(Boolean) as ArchitectureComponent[]

  const dependents = allComponents.filter((c) =>
    (c.dependsOnComponentIds ?? []).includes(comp.id)
  )

  return (
    <div className="arch-detail">
      <div className="arch-detail-header">
        <span className="analysis-tag">{comp.type}</span>
        <h3>{comp.name}</h3>
      </div>
      {comp.description && <p className="arch-detail-desc">{comp.description}</p>}

      <div className="arch-detail-section">
        <p className="card-label">Responsibilities</p>
        <ul className="arch-responsibility-list">
          {comp.responsibilities.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </div>

      {dependencies.length > 0 && (
        <div className="arch-detail-section">
          <p className="card-label">Depends on</p>
          <div className="arch-rel-list">
            {dependencies.map((dep) => (
              <span key={dep.id} className="arch-rel-tag arch-rel-dep">→ {dep.name}</span>
            ))}
          </div>
        </div>
      )}

      {dependents.length > 0 && (
        <div className="arch-detail-section">
          <p className="card-label">Used by</p>
          <div className="arch-rel-list">
            {dependents.map((dep) => (
              <span key={dep.id} className="arch-rel-tag arch-rel-used">← {dep.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StepComponentMap({ analysis }: { analysis: RepositoryAnalysis }) {
  const { architecture } = analysis
  const [selected, setSelected] = useState<string | null>(architecture[0]?.id ?? null)
  const selectedComp = architecture.find((c) => c.id === selected) ?? null

  if (architecture.length === 0) {
    return <p className="explore-empty">No architecture components were identified in the analysis.</p>
  }

  return (
    <div className="arch-map-layout">
      <div className="arch-node-grid">
        {architecture.map((comp) => (
          <ComponentNode
            key={comp.id}
            comp={comp}
            isSelected={selected === comp.id}
            onClick={() => setSelected(comp.id)}
          />
        ))}
      </div>
      {selectedComp && (
        <ComponentDetail comp={selectedComp} allComponents={architecture} />
      )}
    </div>
  )
}

function StepKeyConcepts({ analysis }: { analysis: RepositoryAnalysis }) {
  const { keyConcepts } = analysis
  if (keyConcepts.length === 0) {
    return <p className="explore-empty">No key concepts were identified in the analysis.</p>
  }
  return (
    <div className="explore-step-content">
      <div className="arch-concept-grid">
        {keyConcepts.map((concept) => (
          <div key={concept.id} className="arch-concept-card">
            <strong>{concept.name}</strong>
            <p>{concept.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepDataFlow({ analysis }: { analysis: RepositoryAnalysis }) {
  const { architecture, businessRules } = analysis

  // Build a simple ordered chain from entry-point → business-logic → integration
  const ordered: ArchitectureComponent[] = []
  const byType: Record<string, ArchitectureComponent[]> = {}
  for (const comp of architecture) {
    ;(byType[comp.type] ?? (byType[comp.type] = [])).push(comp)
  }
  const typeOrder = ['entry-point', 'controller', 'service', 'business-logic', 'integration', 'database', 'external']
  for (const t of typeOrder) {
    if (byType[t]) ordered.push(...byType[t])
  }
  // Add any types not in our ordered list
  for (const comp of architecture) {
    if (!ordered.includes(comp)) ordered.push(comp)
  }

  return (
    <div className="explore-step-content">
      {ordered.length > 0 && (
        <div className="arch-flow">
          <p className="explore-sublabel">Execution path through components</p>
          <div className="arch-flow-chain">
            {ordered.map((comp, idx) => (
              <div key={comp.id} className="arch-flow-step">
                <div className="arch-flow-node">
                  <span className="arch-flow-type">{comp.type}</span>
                  <strong>{comp.name}</strong>
                </div>
                {idx < ordered.length - 1 && <span className="arch-flow-arrow">↓</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {businessRules.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <p className="explore-sublabel">Domain rules that govern this flow</p>
          <div className="arch-rule-list">
            {businessRules.slice(0, 4).map((rule) => (
              <div key={rule.id} className="arch-rule">
                <strong>{rule.title}</strong>
                <p>{rule.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {ordered.length === 0 && businessRules.length === 0 && (
        <p className="explore-empty">Architecture flow details were not available in this analysis.</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step config
// ---------------------------------------------------------------------------

const STEP_VIEWS = ['component-map', 'key-concepts', 'data-flow'] as const
type StepView = typeof STEP_VIEWS[number]

const STEP_LABELS: Record<StepView, string> = {
  'component-map': 'Component relationships',
  'key-concepts': 'Key concepts',
  'data-flow': 'Execution flow',
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Stage2Architecture({ analysis, stage, onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  const totalSteps = STEP_VIEWS.length
  const stepKey = STEP_VIEWS[currentStep]

  function markAndAdvance() {
    const next = new Set(completedSteps)
    next.add(currentStep)
    setCompletedSteps(next)

    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onComplete()
    }
  }

  const isLastStep = currentStep === totalSteps - 1

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

      {/* Step navigation tabs */}
      <div className="explore-step-nav">
        {STEP_VIEWS.map((key, index) => (
          <button
            key={key}
            className={`explore-step-tab ${currentStep === index ? 'is-active' : ''} ${completedSteps.has(index) ? 'is-done' : ''}`}
            onClick={() => setCurrentStep(index)}
          >
            <span className="explore-step-num">{String(index + 1).padStart(2, '0')}</span>
            {STEP_LABELS[key]}
            {completedSteps.has(index) && <span className="explore-check">✓</span>}
          </button>
        ))}
      </div>

      {/* Active step card */}
      <Card className="explore-step-card">
        <div className="explore-step-header">
          <h3>{STEP_LABELS[stepKey]}</h3>
          <span className="explore-step-progress">{currentStep + 1} / {totalSteps}</span>
        </div>

        {stepKey === 'component-map' && <StepComponentMap analysis={analysis} />}
        {stepKey === 'key-concepts' && <StepKeyConcepts analysis={analysis} />}
        {stepKey === 'data-flow' && <StepDataFlow analysis={analysis} />}

        <div className="explore-step-actions">
          {currentStep > 0 && (
            <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)}>
              ← Previous
            </Button>
          )}
          <Button onClick={markAndAdvance}>
            {isLastStep ? 'Complete stage →' : 'Next step →'}
          </Button>
        </div>
      </Card>

      {/* Testing info if present */}
      {(analysis.testing.frameworks ?? []).length > 0 && (
        <Card className="explore-objectives-card">
          <p className="card-label">Testing structure</p>
          <div className="arch-testing">
            <div className="analysis-meta-row">
              <span className="card-label">Frameworks</span>
              <div className="analysis-tag-list">
                {analysis.testing.frameworks!.map((f) => (
                  <span key={f} className="analysis-tag">{f}</span>
                ))}
              </div>
            </div>
            {(analysis.testing.commands ?? []).length > 0 && (
              <div className="analysis-meta-row">
                <span className="card-label">Commands</span>
                <div className="analysis-tag-list">
                  {analysis.testing.commands!.map((cmd) => (
                    <code key={cmd} className="analysis-command">{cmd}</code>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
