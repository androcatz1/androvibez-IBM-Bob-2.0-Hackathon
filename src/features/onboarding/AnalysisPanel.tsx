/**
 * AnalysisPanel
 *
 * Renders the full RepositoryAnalysis produced by the AI layer.
 * Also handles loading, error, and "no AI configured" fallback states.
 *
 * This component is pure presentational — it receives state as props and
 * dispatches no side-effects of its own.
 */

import type { RepositoryAnalysis } from '../../types'
import type { ParsedRepository } from '../../services/repository-analysis'
import type { AnalysisStatus } from '../../hooks/useRepositoryAnalysis'
import { Card, StatusBadge } from '../../components/ui'

// ---------------------------------------------------------------------------
// Sub-panels
// ---------------------------------------------------------------------------

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <div className="analysis-section-heading">
      <h3>{title}</h3>
      {count !== undefined && <span className="analysis-count">{count}</span>}
    </div>
  )
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="analysis-tag-list">
      {items.map((item) => (
        <span key={item} className="analysis-tag">{item}</span>
      ))}
    </div>
  )
}

function ProjectSummaryPanel({ analysis }: { analysis: RepositoryAnalysis }) {
  const { projectSummary } = analysis
  return (
    <Card className="analysis-card">
      <SectionHeading title="Project summary" />
      <p className="analysis-description">{projectSummary.description ?? projectSummary.purpose ?? 'No description available.'}</p>
      {projectSummary.projectType && (
        <div className="analysis-meta-row">
          <span className="card-label">Type</span>
          <span>{projectSummary.projectType}</span>
          {projectSummary.maturity && <span className="analysis-muted">· {projectSummary.maturity}</span>}
        </div>
      )}
      {(projectSummary.domains ?? []).length > 0 && (
        <div className="analysis-meta-row">
          <span className="card-label">Domains</span>
          <TagList items={projectSummary.domains!} />
        </div>
      )}
      <div className="analysis-meta-row">
        <span className="card-label">Technology stack</span>
        <TagList items={analysis.technologies} />
      </div>
    </Card>
  )
}

function ArchitecturePanel({ analysis }: { analysis: RepositoryAnalysis }) {
  const { architecture } = analysis
  if (architecture.length === 0) return null
  return (
    <Card className="analysis-card">
      <SectionHeading title="Architecture" count={architecture.length} />
      <div className="analysis-component-list">
        {architecture.map((comp) => (
          <div key={comp.id} className="analysis-component">
            <div className="analysis-component-header">
              <strong>{comp.name}</strong>
              <span className="analysis-tag">{comp.type}</span>
            </div>
            {comp.description && <p className="analysis-component-desc">{comp.description}</p>}
            {comp.responsibilities.length > 0 && (
              <ul className="analysis-list">
                {comp.responsibilities.map((r) => <li key={r}>{r}</li>)}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

function KeyConceptsPanel({ analysis }: { analysis: RepositoryAnalysis }) {
  const { keyConcepts } = analysis
  if (keyConcepts.length === 0) return null
  return (
    <Card className="analysis-card">
      <SectionHeading title="Key concepts" count={keyConcepts.length} />
      <div className="analysis-concept-list">
        {keyConcepts.map((concept) => (
          <div key={concept.id} className="analysis-concept">
            <strong>{concept.name}</strong>
            <p>{concept.description}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

function BusinessRulesPanel({ analysis }: { analysis: RepositoryAnalysis }) {
  const { businessRules } = analysis
  if (businessRules.length === 0) return null
  return (
    <Card className="analysis-card">
      <SectionHeading title="Business / domain rules" count={businessRules.length} />
      <div className="analysis-concept-list">
        {businessRules.map((rule) => (
          <div key={rule.id} className="analysis-concept">
            <div className="analysis-component-header">
              <strong>{rule.title}</strong>
              {rule.domain && <span className="analysis-muted">{rule.domain}</span>}
            </div>
            <p>{rule.description}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

function ImportantFilesPanel({ analysis }: { analysis: RepositoryAnalysis }) {
  const { importantFiles } = analysis
  if (importantFiles.length === 0) return null
  return (
    <Card className="analysis-card">
      <SectionHeading title="Important files" count={importantFiles.length} />
      <div className="analysis-file-list">
        {importantFiles.map((file) => (
          <div key={file.id} className="analysis-file">
            <div className="analysis-file-header">
              <code className="analysis-file-path">{file.path}</code>
              {file.isEntryPoint && <span className="analysis-tag analysis-tag-entry">entry</span>}
              {file.isTest && <span className="analysis-tag analysis-tag-test">test</span>}
              {file.isDocumentation && <span className="analysis-tag analysis-tag-doc">doc</span>}
            </div>
            {file.summary && <p className="analysis-file-summary">{file.summary}</p>}
          </div>
        ))}
      </div>
    </Card>
  )
}

function LearningObjectivesPanel({ analysis }: { analysis: RepositoryAnalysis }) {
  const { learningObjectives } = analysis
  if (learningObjectives.length === 0) return null
  return (
    <Card className="analysis-card">
      <SectionHeading title="Learning objectives" count={learningObjectives.length} />
      <ol className="analysis-objectives">
        {learningObjectives.map((obj, idx) => (
          <li key={obj.id} className="analysis-objective">
            <div className="analysis-component-header">
              <span className="analysis-objective-num">{String(idx + 1).padStart(2, '0')}</span>
              <strong>{obj.title}</strong>
              {obj.level && <span className="analysis-tag">{obj.level}</span>}
            </div>
            <p>{obj.description}</p>
            {(obj.measurableOutcomes ?? []).length > 0 && (
              <ul className="analysis-list">
                {obj.measurableOutcomes!.map((o) => <li key={o}>{o}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </Card>
  )
}

function TestingPanel({ analysis }: { analysis: RepositoryAnalysis }) {
  const { testing } = analysis
  const hasContent =
    (testing.frameworks?.length ?? 0) > 0 ||
    (testing.commands?.length ?? 0) > 0 ||
    (testing.conventions?.length ?? 0) > 0 ||
    testing.coverageNotes

  if (!hasContent) return null
  return (
    <Card className="analysis-card">
      <SectionHeading title="Testing structure" />
      {(testing.frameworks ?? []).length > 0 && (
        <div className="analysis-meta-row">
          <span className="card-label">Frameworks</span>
          <TagList items={testing.frameworks!} />
        </div>
      )}
      {(testing.commands ?? []).length > 0 && (
        <div className="analysis-meta-row">
          <span className="card-label">Commands</span>
          <div className="analysis-tag-list">
            {testing.commands!.map((cmd) => <code key={cmd} className="analysis-command">{cmd}</code>)}
          </div>
        </div>
      )}
      {(testing.conventions ?? []).length > 0 && (
        <ul className="analysis-list">
          {testing.conventions!.map((c) => <li key={c}>{c}</li>)}
        </ul>
      )}
      {testing.coverageNotes && <p className="analysis-muted">{testing.coverageNotes}</p>}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

function AnalysisLoading({ status }: { status: AnalysisStatus }) {
  const label = status === 'parsing' ? 'Reading repository…' : 'Analysing with AI…'
  const detail = status === 'parsing'
    ? 'Classifying files and computing fingerprint.'
    : 'Generating architecture overview, concepts, and learning path.'

  return (
    <Card className="analysis-card analysis-loading">
      <div className="analysis-loading-header">
        <span className="spinner" />
        <strong>{label}</strong>
      </div>
      <p className="analysis-muted">{detail}</p>
      <div className="analysis-skeleton">
        <span className="loading-bar loading-wide" />
        <span className="loading-bar loading-mid" />
        <span className="loading-bar loading-short" />
        <span className="loading-bar loading-mid" />
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function AnalysisError({ error, parsedRepo }: { error: string; parsedRepo: ParsedRepository | null }) {
  return (
    <Card className="analysis-card">
      <div className="setup-feedback feedback-error" role="alert">
        <strong>Analysis failed.</strong>
        <span>{error}</span>
      </div>
      {parsedRepo && (
        <div className="analysis-fallback">
          <p className="card-label">Repository was parsed successfully — partial information is available.</p>
          <div className="analysis-meta-row">
            <span className="card-label">Files</span>
            <span>{parsedRepo.files.length}</span>
          </div>
          <div className="analysis-meta-row">
            <span className="card-label">Languages</span>
            <TagList items={parsedRepo.detectedLanguages.slice(0, 6).map((l) => l.name)} />
          </div>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Pending state (parsed but no AI service configured)
// ---------------------------------------------------------------------------

function AnalysisPending({ parsedRepo }: { parsedRepo: ParsedRepository | null }) {
  return (
    <Card className="analysis-card">
      <div className="setup-feedback" role="status">
        <span className="spinner" />
        <strong>Repository parsed — waiting for AI analysis service.</strong>
      </div>
      {parsedRepo && (
        <div className="analysis-fallback">
          <p className="analysis-muted">
            Configure an <code>AnalysisService</code> to generate the full onboarding analysis.
            The repository has been parsed and is ready.
          </p>
          <div className="analysis-meta-row">
            <span className="card-label">Files indexed</span>
            <span>{parsedRepo.files.length}</span>
          </div>
          <div className="analysis-meta-row">
            <span className="card-label">Languages</span>
            <TagList items={parsedRepo.detectedLanguages.slice(0, 6).map((l) => l.name)} />
          </div>
          <div className="analysis-meta-row">
            <span className="card-label">Token budget used</span>
            <span>{parsedRepo.estimatedTokenCount.toLocaleString()} tokens</span>
          </div>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface AnalysisPanelProps {
  status: AnalysisStatus
  analysis: RepositoryAnalysis | null
  parsedRepo: ParsedRepository | null
  error: string | null
  isCacheHit: boolean
}

export function AnalysisPanel({ status, analysis, parsedRepo, error, isCacheHit }: AnalysisPanelProps) {
  if (status === 'parsing' || status === 'analyzing') {
    return <AnalysisLoading status={status} />
  }

  if (status === 'error') {
    return <AnalysisError error={error ?? 'Unknown error'} parsedRepo={parsedRepo} />
  }

  if (!analysis) {
    return <AnalysisPending parsedRepo={parsedRepo} />
  }

  return (
    <div className="analysis-panel">
      <div className="analysis-panel-header">
        <div>
          <span className="card-label">Repository analysis</span>
          <strong>{analysis.projectSummary.name}</strong>
        </div>
        <StatusBadge tone="complete">
          {isCacheHit ? 'Cached' : 'Ready'}
        </StatusBadge>
      </div>

      <ProjectSummaryPanel analysis={analysis} />
      <ArchitecturePanel analysis={analysis} />
      <KeyConceptsPanel analysis={analysis} />
      <BusinessRulesPanel analysis={analysis} />
      <ImportantFilesPanel analysis={analysis} />
      <LearningObjectivesPanel analysis={analysis} />
      <TestingPanel analysis={analysis} />

      {(analysis.warnings ?? []).length > 0 && (
        <Card className="analysis-card">
          <SectionHeading title="Warnings" count={analysis.warnings!.length} />
          <ul className="analysis-list analysis-warnings">
            {analysis.warnings!.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </Card>
      )}
    </div>
  )
}
