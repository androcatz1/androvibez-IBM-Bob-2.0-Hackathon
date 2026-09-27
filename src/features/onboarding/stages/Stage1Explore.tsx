/**
 * Stage1Explore — Explore the Codebase
 *
 * An interactive step-by-step exploration of what the project does,
 * what technologies it uses, which files matter, and what the major
 * components are. All data comes from the existing RepositoryAnalysis.
 */

import { useState } from 'react'
import { Button, Card, StatusBadge } from '../../../components/ui'
import type { RepositoryAnalysis } from '../../../types'
import type { OnboardingStage } from '../questBuilder'

interface Props {
  analysis: RepositoryAnalysis
  stage: OnboardingStage
  onComplete: () => void
}

// ---------------------------------------------------------------------------
// Sub-views for each step
// ---------------------------------------------------------------------------

function StepPurpose({ analysis }: { analysis: RepositoryAnalysis }) {
  const { projectSummary } = analysis
  return (
    <div className="explore-step-content">
      <p className="explore-lead">
        {projectSummary.description ?? projectSummary.purpose ?? 'No description available.'}
      </p>
      <div className="explore-meta-grid">
        {projectSummary.projectType && (
          <div className="explore-meta-item">
            <span className="card-label">Type</span>
            <span>{projectSummary.projectType}</span>
          </div>
        )}
        {projectSummary.maturity && (
          <div className="explore-meta-item">
            <span className="card-label">Maturity</span>
            <span>{projectSummary.maturity}</span>
          </div>
        )}
        {(projectSummary.domains ?? []).length > 0 && (
          <div className="explore-meta-item">
            <span className="card-label">Domains</span>
            <span>{projectSummary.domains!.join(', ')}</span>
          </div>
        )}
        {(projectSummary.audiences ?? []).length > 0 && (
          <div className="explore-meta-item">
            <span className="card-label">Audience</span>
            <span>{projectSummary.audiences!.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function StepTech({ analysis }: { analysis: RepositoryAnalysis }) {
  const { technologies, dependencies } = analysis
  const prodDeps = dependencies.filter((d) => !d.isDevelopmentOnly)
  const devDeps = dependencies.filter((d) => d.isDevelopmentOnly)

  return (
    <div className="explore-step-content">
      <p className="explore-sublabel">Technology stack</p>
      <div className="explore-tag-grid">
        {technologies.map((tech) => (
          <span key={tech} className="explore-tech-tag">{tech}</span>
        ))}
      </div>

      {prodDeps.length > 0 && (
        <>
          <p className="explore-sublabel" style={{ marginTop: '20px' }}>Key dependencies</p>
          <div className="explore-dep-list">
            {prodDeps.slice(0, 8).map((dep) => (
              <div key={dep.id} className="explore-dep">
                <strong>{dep.name}</strong>
                {dep.version && <span className="explore-dep-version">{dep.version}</span>}
                {dep.purpose && <span className="explore-dep-purpose">{dep.purpose}</span>}
              </div>
            ))}
          </div>
        </>
      )}

      {devDeps.length > 0 && (
        <>
          <p className="explore-sublabel" style={{ marginTop: '16px' }}>Development tools</p>
          <div className="explore-tag-grid">
            {devDeps.slice(0, 6).map((dep) => (
              <span key={dep.id} className="analysis-tag">{dep.name}</span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function StepFiles({ analysis }: { analysis: RepositoryAnalysis }) {
  const { importantFiles } = analysis
  const entryPoints = importantFiles.filter((f) => f.isEntryPoint)
  const docs = importantFiles.filter((f) => f.isDocumentation)
  const others = importantFiles.filter((f) => !f.isEntryPoint && !f.isDocumentation)

  return (
    <div className="explore-step-content">
      {entryPoints.length > 0 && (
        <div className="explore-file-group">
          <p className="explore-sublabel">Entry points — start reading here</p>
          {entryPoints.map((file) => (
            <div key={file.id} className="explore-file-item explore-file-entry">
              <code>{file.path}</code>
              {file.summary && <span>{file.summary}</span>}
            </div>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="explore-file-group">
          <p className="explore-sublabel">Important files</p>
          {others.map((file) => (
            <div key={file.id} className="explore-file-item">
              <code>{file.path}</code>
              {file.role && <span className="explore-file-role">{file.role}</span>}
              {file.summary && <span className="explore-file-summary">{file.summary}</span>}
            </div>
          ))}
        </div>
      )}

      {docs.length > 0 && (
        <div className="explore-file-group">
          <p className="explore-sublabel">Documentation</p>
          {docs.map((file) => (
            <div key={file.id} className="explore-file-item explore-file-doc">
              <code>{file.path}</code>
              {file.summary && <span>{file.summary}</span>}
            </div>
          ))}
        </div>
      )}

      {importantFiles.length === 0 && (
        <p className="explore-empty">No important files were identified in the analysis.</p>
      )}
    </div>
  )
}

function StepComponents({ analysis }: { analysis: RepositoryAnalysis }) {
  const { architecture } = analysis
  return (
    <div className="explore-step-content">
      {architecture.length === 0 && (
        <p className="explore-empty">No components were identified in the analysis.</p>
      )}
      <div className="explore-component-grid">
        {architecture.map((comp) => (
          <div key={comp.id} className="explore-component-card">
            <div className="explore-component-header">
              <strong>{comp.name}</strong>
              <span className="analysis-tag">{comp.type}</span>
            </div>
            {comp.description && (
              <p className="explore-component-desc">{comp.description}</p>
            )}
            {comp.responsibilities.length > 0 && (
              <ul className="explore-responsibility-list">
                {comp.responsibilities.slice(0, 3).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step renderer mapping
// ---------------------------------------------------------------------------

const STEP_VIEWS = ['purpose', 'tech', 'files', 'components'] as const
type StepView = typeof STEP_VIEWS[number]

const STEP_LABELS: Record<StepView, string> = {
  purpose: 'What does it do?',
  tech: 'Technology stack',
  files: 'Important files',
  components: 'Major components',
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Stage1Explore({ analysis, stage, onComplete }: Props) {
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

  function goToStep(index: number) {
    setCurrentStep(index)
  }

  const isLastStep = currentStep === totalSteps - 1
  const allComplete = completedSteps.size >= totalSteps

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
            onClick={() => goToStep(index)}
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
          <span className="explore-step-progress">
            {currentStep + 1} / {totalSteps}
          </span>
        </div>

        {stepKey === 'purpose' && <StepPurpose analysis={analysis} />}
        {stepKey === 'tech' && <StepTech analysis={analysis} />}
        {stepKey === 'files' && <StepFiles analysis={analysis} />}
        {stepKey === 'components' && <StepComponents analysis={analysis} />}

        <div className="explore-step-actions">
          {currentStep > 0 && (
            <Button variant="ghost" onClick={() => goToStep(currentStep - 1)}>
              ← Previous
            </Button>
          )}
          <Button onClick={markAndAdvance}>
            {isLastStep
              ? allComplete ? 'Complete stage →' : 'Finish & complete →'
              : 'Next step →'}
          </Button>
        </div>
      </Card>

      {/* Learning objectives for this stage */}
      {analysis.learningObjectives.length > 0 && (
        <Card className="explore-objectives-card">
          <p className="card-label">Learning objectives for this stage</p>
          <ul className="explore-objectives-list">
            {analysis.learningObjectives.slice(0, 3).map((obj) => (
              <li key={obj.id}>
                <strong>{obj.title}</strong>
                <span>{obj.description}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
