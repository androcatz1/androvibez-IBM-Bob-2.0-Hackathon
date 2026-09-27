/**
 * questBuilder
 *
 * Derives a 6-stage onboarding journey from an existing RepositoryAnalysis.
 * No AI calls — all content comes from the already-generated analysis.
 */

import type { RepositoryAnalysis } from '../../types'

export type StageId =
  | 'explore'
  | 'architecture'
  | 'knowledge'
  | 'investigation'
  | 'predict'
  | 'contribution'

export type StageStatus = 'available' | 'locked' | 'in-progress' | 'completed'

export interface StageStep {
  id: string
  title: string
  description: string
  /** ids of things from the analysis (files, concepts, components) this step highlights */
  highlightIds?: string[]
}

export interface OnboardingStage {
  id: StageId
  index: number
  title: string
  tagline: string
  description: string
  estimatedMinutes: number
  status: StageStatus
  steps: StageStep[]
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildOnboardingJourney(analysis: RepositoryAnalysis): OnboardingStage[] {
  const { projectSummary, technologies, architecture, importantFiles, keyConcepts } = analysis

  // Stage 1 — Explore the Codebase
  const exploreSteps: StageStep[] = [
    {
      id: 'explore-purpose',
      title: 'What does this project do?',
      description: projectSummary.description ?? projectSummary.purpose ?? 'Understand the project\'s purpose and goals.',
      highlightIds: [],
    },
    {
      id: 'explore-tech',
      title: 'What technologies power it?',
      description: technologies.length > 0
        ? `This project uses ${technologies.slice(0, 5).join(', ')}${technologies.length > 5 ? ', and more' : ''}.`
        : 'Explore the technology stack.',
      highlightIds: [],
    },
    {
      id: 'explore-files',
      title: 'Where do I start reading?',
      description: importantFiles.length > 0
        ? `There are ${importantFiles.length} key files to orient yourself. Entry points and documentation are marked.`
        : 'Find the entry points and important files.',
      highlightIds: importantFiles.slice(0, 5).map((f) => f.id),
    },
    {
      id: 'explore-components',
      title: 'What are the major pieces?',
      description: architecture.length > 0
        ? `The codebase has ${architecture.length} major component${architecture.length !== 1 ? 's' : ''}. Each has a clear set of responsibilities.`
        : 'Identify the main components.',
      highlightIds: architecture.slice(0, 4).map((c) => c.id),
    },
  ]

  // Stage 2 — Understand the Architecture
  const archSteps: StageStep[] = [
    {
      id: 'arch-map',
      title: 'How are components connected?',
      description: architecture.length > 0
        ? `Map the relationships between ${architecture.map((c) => c.name).join(', ')}.`
        : 'Map component relationships.',
      highlightIds: architecture.map((c) => c.id),
    },
    {
      id: 'arch-concepts',
      title: 'What are the key concepts?',
      description: keyConcepts.length > 0
        ? `${keyConcepts.length} key concept${keyConcepts.length !== 1 ? 's' : ''} shape how this codebase works.`
        : 'Understand the core domain concepts.',
      highlightIds: keyConcepts.map((c) => c.id),
    },
    {
      id: 'arch-flow',
      title: 'How does data flow through the system?',
      description: 'Follow a request or data item from entry to output and identify each responsibility boundary.',
      highlightIds: [],
    },
  ]

  // Stage 3 — Knowledge Check steps (derived from analysis content)
  const knowledgeSteps: StageStep[] = [
    {
      id: 'know-components',
      title: 'Component responsibilities',
      description: `Identify which component owns each responsibility across ${architecture.length} component${architecture.length !== 1 ? 's' : ''}.`,
      highlightIds: architecture.map((c) => c.id),
    },
    {
      id: 'know-concepts',
      title: 'Key concepts',
      description: keyConcepts.length > 0
        ? `True/false questions on ${keyConcepts.length} key concept${keyConcepts.length !== 1 ? 's' : ''}.`
        : 'Identify core concepts from the analysis.',
      highlightIds: keyConcepts.map((c) => c.id),
    },
    {
      id: 'know-deps',
      title: 'Dependencies & rules',
      description: 'Match dependencies to their purpose and identify business rule ownership.',
      highlightIds: [],
    },
  ]

  // Stage 4 — Investigation steps
  const investigationSteps: StageStep[] = [
    {
      id: 'inv-identify',
      title: 'Identify relevant components',
      description: 'Select which parts of the architecture are involved in the problem.',
      highlightIds: architecture.map((c) => c.id),
    },
    {
      id: 'inv-path',
      title: 'Trace the execution path',
      description: 'Describe the request path from entry point to where the bug manifests.',
      highlightIds: [],
    },
    {
      id: 'inv-cause',
      title: 'State the likely cause',
      description: 'Form a hypothesis and support it with evidence from the analysis.',
      highlightIds: [],
    },
  ]

  // Stage 5 — Change Impact steps
  const predictSteps: StageStep[] = [
    {
      id: 'pred-components',
      title: 'Identify affected components',
      description: 'Select all components that the proposed change will touch or break.',
      highlightIds: architecture.map((c) => c.id),
    },
    {
      id: 'pred-deps',
      title: 'Dependencies & tests',
      description: 'Which dependencies are involved and which tests need updating?',
      highlightIds: [],
    },
    {
      id: 'pred-risks',
      title: 'State the risks',
      description: 'What could go wrong? List at least one concrete risk.',
      highlightIds: [],
    },
  ]

  // Stage 6 — First Contribution steps
  const contributionSteps: StageStep[] = [
    {
      id: 'contrib-investigate',
      title: 'Which files would you investigate?',
      description: 'Identify the files you would read before touching anything.',
      highlightIds: [],
    },
    {
      id: 'contrib-components',
      title: 'Which components are involved?',
      description: 'Select the components your change will touch.',
      highlightIds: architecture.map((c) => c.id),
    },
    {
      id: 'contrib-existing',
      title: 'What existing behaviour must you understand?',
      description: 'Explain what the current code does that your change extends or depends on.',
      highlightIds: [],
    },
    {
      id: 'contrib-changes',
      title: 'What changes would you make?',
      description: 'Describe your proposed implementation approach at a high level.',
      highlightIds: [],
    },
    {
      id: 'contrib-tests',
      title: 'What tests would you add or modify?',
      description: 'Name the tests you would write and the command you would run.',
      highlightIds: [],
    },
  ]

  const stages: OnboardingStage[] = [
    {
      id: 'explore',
      index: 1,
      title: 'Explore the Codebase',
      tagline: 'Get your bearings',
      description: 'Discover what this project does, what it\'s built with, and where the most important pieces live.',
      estimatedMinutes: 10,
      status: 'available',
      steps: exploreSteps,
    },
    {
      id: 'architecture',
      index: 2,
      title: 'Understand the Architecture',
      tagline: 'Connect the pieces',
      description: 'Map the major components, understand how they relate, and trace how data moves through the system.',
      estimatedMinutes: 15,
      status: 'locked',
      steps: archSteps,
    },
    {
      id: 'knowledge',
      index: 3,
      title: 'Prove Your Knowledge',
      tagline: 'Answer → not read',
      description: 'Answer targeted questions drawn from the codebase to confirm your mental model.',
      estimatedMinutes: 10,
      status: 'locked',
      steps: knowledgeSteps,
    },
    {
      id: 'investigation',
      index: 4,
      title: 'Investigate a Problem',
      tagline: 'Think like a debugger',
      description: 'Work through a realistic scenario: find the root cause using only what you have learned.',
      estimatedMinutes: 20,
      status: 'locked',
      steps: investigationSteps,
    },
    {
      id: 'predict',
      index: 5,
      title: 'Predict a Change',
      tagline: 'Think in systems',
      description: 'Before touching code, predict which components a proposed change would affect and why.',
      estimatedMinutes: 15,
      status: 'locked',
      steps: predictSteps,
    },
    {
      id: 'contribution',
      index: 6,
      title: 'First Contribution',
      tagline: 'Ship something real',
      description: 'Plan a real, well-scoped change — identify the files, components, existing behaviour, your approach, and the tests you would write.',
      estimatedMinutes: 25,
      status: 'locked',
      steps: contributionSteps,
    },
  ]

  return stages
}
