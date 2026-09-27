/**
 * adaptiveProgress
 *
 * Lightweight adaptive progress system.
 * Computes per-stage scores from the developer's answers across all stages,
 * identifies knowledge gaps, and recommends what to review next.
 *
 * No ML — just deterministic scoring over the answers already collected.
 * No additional AI calls.
 */

import type { RepositoryAnalysis } from '../../types'

// ---------------------------------------------------------------------------
// Stage performance records — each stage stores its own result
// ---------------------------------------------------------------------------

/** Knowledge Check (Stage 3) result */
export interface KnowledgeStageResult {
  totalQuestions: number
  correctAnswers: number
}

/** Investigation (Stage 4) result */
export interface InvestigationStageResult {
  correctComponentCount: number
  totalTargetComponents: number
  hadGoodReasoning: boolean
}

/** Change Impact (Stage 5) result */
export interface ChangeImpactStageResult {
  correctComponentCount: number
  totalExpectedComponents: number
  hadGoodRisks: boolean
}

/** Contribution (Stage 6) result */
export interface ContributionStageResult {
  filesIdentified: number
  suggestedFilesTotal: number
  correctComponentCount: number
  totalTargetComponents: number
  changesQuality: 'good' | 'partial' | 'minimal'
  testsQuality: 'good' | 'partial' | 'minimal'
}

export interface AllStageResults {
  knowledge?: KnowledgeStageResult
  investigation?: InvestigationStageResult
  changeImpact?: ChangeImpactStageResult
  contribution?: ContributionStageResult
}

// ---------------------------------------------------------------------------
// Per-stage scores (0–100)
// ---------------------------------------------------------------------------

/** Exploration and Architecture stages are "read + confirm" — completion = 100. */
function scoreExplore(completed: boolean): number {
  return completed ? 100 : 0
}

function scoreArchitecture(completed: boolean): number {
  return completed ? 100 : 0
}

function scoreKnowledge(result?: KnowledgeStageResult): number {
  if (!result) return 0
  if (result.totalQuestions === 0) return 100
  return Math.round((result.correctAnswers / result.totalQuestions) * 100)
}

function scoreInvestigation(result?: InvestigationStageResult): number {
  if (!result) return 0
  const compScore = result.totalTargetComponents > 0
    ? (result.correctComponentCount / result.totalTargetComponents) * 70
    : 70
  const reasoningScore = result.hadGoodReasoning ? 30 : 0
  return Math.round(compScore + reasoningScore)
}

function scoreChangeImpact(result?: ChangeImpactStageResult): number {
  if (!result) return 0
  const compScore = result.totalExpectedComponents > 0
    ? (result.correctComponentCount / result.totalExpectedComponents) * 70
    : 70
  const riskScore = result.hadGoodRisks ? 30 : 0
  return Math.round(compScore + riskScore)
}

function scoreContribution(result?: ContributionStageResult): number {
  if (!result) return 0
  const fileScore = result.suggestedFilesTotal > 0
    ? Math.min(1, result.filesIdentified / result.suggestedFilesTotal) * 20
    : 20
  const compScore = result.totalTargetComponents > 0
    ? (result.correctComponentCount / result.totalTargetComponents) * 30
    : 30
  const changesScore = result.changesQuality === 'good' ? 25 : result.changesQuality === 'partial' ? 13 : 0
  const testsScore = result.testsQuality === 'good' ? 25 : result.testsQuality === 'partial' ? 13 : 0
  return Math.round(fileScore + compScore + changesScore + testsScore)
}

// ---------------------------------------------------------------------------
// Gap detection
// ---------------------------------------------------------------------------

export interface KnowledgeGapSummary {
  id: string
  area: string
  label: string
  detail: string
  severity: 'low' | 'medium' | 'high'
}

function detectGaps(
  scores: Record<string, number>,
  results: AllStageResults,
  analysis: RepositoryAnalysis,
): KnowledgeGapSummary[] {
  const gaps: KnowledgeGapSummary[] = []

  if (scores.knowledge < 60) {
    gaps.push({
      id: 'gap-knowledge',
      area: 'knowledge',
      label: 'Component & concept recall',
      detail: `Scored ${scores.knowledge}% on knowledge check. Review component responsibilities and key concepts in the Architecture stage.`,
      severity: scores.knowledge < 40 ? 'high' : 'medium',
    })
  }

  if (scores.investigation < 60) {
    gaps.push({
      id: 'gap-investigation',
      area: 'investigation',
      label: 'Execution path tracing',
      detail: `Scored ${scores.investigation}% on the investigation. Practice tracing data through ${analysis.architecture.slice(0, 2).map((c) => c.name).join(' → ')}.`,
      severity: scores.investigation < 40 ? 'high' : 'medium',
    })
  }

  if (scores.changeImpact < 60) {
    gaps.push({
      id: 'gap-change-impact',
      area: 'changeImpact',
      label: 'Service dependency awareness',
      detail: `Scored ${scores.changeImpact}% on change impact prediction. Revisit component dependencies in the Architecture stage.`,
      severity: scores.changeImpact < 40 ? 'high' : 'medium',
    })
  }

  if (scores.contribution < 60) {
    const sub = results.contribution
    if (sub && sub.testsQuality === 'minimal') {
      gaps.push({
        id: 'gap-testing',
        area: 'contribution',
        label: 'Testing strategy',
        detail: `The testing plan was thin. Review ${analysis.testing.frameworks?.join(', ') ?? 'the test setup'} and the test locations noted in the analysis.`,
        severity: 'medium',
      })
    } else {
      gaps.push({
        id: 'gap-contribution',
        area: 'contribution',
        label: 'Contribution planning',
        detail: 'The proposed approach missed some components or lacked detail. Re-read the component map and try again.',
        severity: 'low',
      })
    }
  }

  return gaps
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

function buildRecommendations(
  gaps: KnowledgeGapSummary[],
  overallPercent: number,
): string[] {
  const recs: string[] = []

  if (overallPercent >= 80) {
    recs.push('You are ready to make your first real contribution. Pick a small open issue and apply your plan.')
  } else if (overallPercent >= 60) {
    recs.push('You have a solid foundation. Revisit any flagged gaps before tackling a production task.')
  } else {
    recs.push('Re-read the architecture overview and retrace the data flow before contributing.')
  }

  for (const gap of gaps) {
    if (gap.area === 'knowledge') recs.push('Review: Architecture Stage → component responsibilities and key concepts.')
    if (gap.area === 'investigation') recs.push('Practice: trace a user-facing action through every component layer.')
    if (gap.area === 'changeImpact') recs.push('Study: the dependency map in the Architecture Stage to understand ripple effects.')
    if (gap.area === 'testing') recs.push('Read: existing test files and run the test suite to understand coverage patterns.')
  }

  return recs
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface AdaptiveProgressResult {
  stageScores: Record<string, number>       // stageId → 0–100
  overallPercent: number                     // weighted average across completed stages
  conceptsUnderstood: string[]               // positive observations
  gaps: KnowledgeGapSummary[]
  recommendations: string[]
}

export function computeAdaptiveProgress(
  completedStageIds: string[],
  results: AllStageResults,
  analysis: RepositoryAnalysis,
): AdaptiveProgressResult {
  const stageScores: Record<string, number> = {
    explore:      scoreExplore(completedStageIds.includes('explore')),
    architecture: scoreArchitecture(completedStageIds.includes('architecture')),
    knowledge:    scoreKnowledge(results.knowledge),
    investigation: scoreInvestigation(results.investigation),
    changeImpact:  scoreChangeImpact(results.changeImpact),
    contribution:  scoreContribution(results.contribution),
  }

  const completedScores = completedStageIds
    .map((id) => stageScores[id] ?? 0)
  const overallPercent = completedScores.length > 0
    ? Math.round(completedScores.reduce((a, b) => a + b, 0) / completedScores.length)
    : 0

  const conceptsUnderstood: string[] = []
  if (stageScores.explore === 100) conceptsUnderstood.push(`Project purpose and technology stack of ${analysis.projectSummary.name}`)
  if (stageScores.architecture === 100) conceptsUnderstood.push(`Architecture: ${analysis.architecture.slice(0, 3).map((c) => c.name).join(', ')}`)
  if (stageScores.knowledge >= 60) conceptsUnderstood.push('Component responsibilities and key concept definitions')
  if (stageScores.investigation >= 60) conceptsUnderstood.push('Execution path tracing and root-cause reasoning')
  if (stageScores.changeImpact >= 60) conceptsUnderstood.push('Systems thinking: change impact and dependency awareness')
  if (stageScores.contribution >= 60) conceptsUnderstood.push('Contribution planning: files, components, testing strategy')

  const gaps = detectGaps(stageScores, results, analysis)
  const recommendations = buildRecommendations(gaps, overallPercent)

  return { stageScores, overallPercent, conceptsUnderstood, gaps, recommendations }
}
