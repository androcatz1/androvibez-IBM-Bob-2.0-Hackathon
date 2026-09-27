/**
 * challengeBuilder
 *
 * Derives interactive challenge content (Knowledge, Investigation, Change Impact)
 * from an existing RepositoryAnalysis — zero additional AI calls.
 */

import type {
  RepositoryAnalysis,
  ArchitectureComponent,
  BusinessRule,
  RepositoryFile,
} from '../../types'

// ---------------------------------------------------------------------------
// Knowledge Check
// ---------------------------------------------------------------------------

export type QuestionType = 'single-choice' | 'true-false'

export interface BuiltAnswer {
  id: string
  text: string
  isCorrect: boolean
}

export interface BuiltQuestion {
  id: string
  prompt: string
  type: QuestionType
  answers: BuiltAnswer[]
  explanation: string
  concept: string
}

/**
 * Generates 4–6 questions directly from the RepositoryAnalysis.
 * Questions target architecture understanding, component responsibilities,
 * key concepts, and important dependencies.
 */
export function buildKnowledgeQuestions(analysis: RepositoryAnalysis): BuiltQuestion[] {
  const questions: BuiltQuestion[] = []
  const { architecture, keyConcepts, dependencies, projectSummary, businessRules } = analysis

  // Q: Component responsibility (one per component, up to 3)
  const compQuestions = architecture.slice(0, 3).flatMap((comp, idx): BuiltQuestion[] => {
    const responsibility = comp.responsibilities[0]
    if (!responsibility) return []
    // Build 2 distractor components
    const others = architecture.filter((c) => c.id !== comp.id).slice(0, 2)
    if (others.length < 1) return []
    const correct: BuiltAnswer = { id: `qa-${idx}-correct`, text: comp.name, isCorrect: true }
    const distractors: BuiltAnswer[] = others.map((c, i) => ({
      id: `qa-${idx}-d${i}`,
      text: c.name,
      isCorrect: false,
    }))
    const answers = shuffle([correct, ...distractors])
    return [{
      id: `q-comp-${comp.id}`,
      prompt: `Which component is responsible for: "${responsibility}"?`,
      type: 'single-choice',
      answers,
      explanation: `${comp.name} (${comp.type}) handles this responsibility. ${comp.description ?? ''}`.trim(),
      concept: `${comp.name} responsibilities`,
    }]
  })
  questions.push(...compQuestions)

  // Q: Key concept identification (up to 2 true/false)
  keyConcepts.slice(0, 2).forEach((concept, idx) => {
    // True: the real description; False: a description swapped from another concept
    const other = keyConcepts.find((c) => c.id !== concept.id)
    if (other) {
      questions.push({
        id: `q-concept-tf-${concept.id}`,
        prompt: `True or False: "${concept.name}" is defined as — "${other.description}"`,
        type: 'true-false',
        answers: [
          { id: `qt-${idx}-true`, text: 'True', isCorrect: false },
          { id: `qt-${idx}-false`, text: 'False', isCorrect: true },
        ],
        explanation: `"${concept.name}" is actually: "${concept.description}". The description given belongs to "${other.name}".`,
        concept: concept.name,
      })
    } else {
      questions.push({
        id: `q-concept-tf-${concept.id}`,
        prompt: `True or False: "${concept.name}" — "${concept.description}"`,
        type: 'true-false',
        answers: [
          { id: `qt-${idx}-true`, text: 'True', isCorrect: true },
          { id: `qt-${idx}-false`, text: 'False', isCorrect: false },
        ],
        explanation: `Correct — "${concept.name}" is exactly: "${concept.description}".`,
        concept: concept.name,
      })
    }
  })

  // Q: Important dependency purpose (up to 1)
  const prodDeps = dependencies.filter((d) => !d.isDevelopmentOnly && d.purpose)
  if (prodDeps.length >= 2) {
    const dep = prodDeps[0]
    const distractor = prodDeps[1]
    questions.push({
      id: `q-dep-${dep.id}`,
      prompt: `What is the primary purpose of the "${dep.name}" dependency?`,
      type: 'single-choice',
      answers: shuffle([
        { id: 'qd-correct', text: dep.purpose!, isCorrect: true },
        { id: 'qd-wrong', text: distractor.purpose!, isCorrect: false },
      ]),
      explanation: `${dep.name} is used for: ${dep.purpose}.`,
      concept: `${dep.name} dependency`,
    })
  }

  // Q: Business rule ownership (up to 1)
  const rule = businessRules[0]
  if (rule && architecture.length >= 2) {
    const sourceComp = architecture.find((c) =>
      (c.fileIds ?? []).some((fid) => (rule.sourceFileIds ?? []).includes(fid))
    ) ?? architecture[0]
    const others = architecture.filter((c) => c.id !== sourceComp.id).slice(0, 2)
    const answers: BuiltAnswer[] = shuffle([
      { id: 'qr-correct', text: sourceComp.name, isCorrect: true },
      ...others.map((c, i) => ({ id: `qr-d${i}`, text: c.name, isCorrect: false })),
    ])
    questions.push({
      id: `q-rule-${rule.id}`,
      prompt: `The business rule "${rule.title}" most likely originates from which component?`,
      type: 'single-choice',
      answers,
      explanation: `"${rule.title}": ${rule.description}. This rule is associated with the ${sourceComp.name} component.`,
      concept: rule.title,
    })
  }

  // Q: Project purpose (true/false sanity check)
  if (projectSummary.description ?? projectSummary.purpose) {
    questions.push({
      id: 'q-project-purpose',
      prompt: `True or False: The project "${projectSummary.name}" is described as — "${projectSummary.description ?? projectSummary.purpose}"`,
      type: 'true-false',
      answers: [
        { id: 'qpp-true', text: 'True', isCorrect: true },
        { id: 'qpp-false', text: 'False', isCorrect: false },
      ],
      explanation: `Correct — this matches the project summary from the analysis.`,
      concept: 'Project purpose',
    })
  }

  return questions.slice(0, 6)
}

// ---------------------------------------------------------------------------
// Investigation Scenario
// ---------------------------------------------------------------------------

export interface BuiltInvestigationScenario {
  id: string
  title: string
  prompt: string
  context: string
  /** Things the developer should identify */
  targetComponents: ArchitectureComponent[]
  targetFiles: RepositoryFile[]
  relatedRule?: BusinessRule
  hints: string[]
  /** Model answer points for feedback */
  expectedFindings: string[]
}

export function buildInvestigationScenario(analysis: RepositoryAnalysis): BuiltInvestigationScenario | null {
  const { architecture, businessRules, importantFiles, projectSummary } = analysis
  if (architecture.length < 2) return null

  // Pick the most "downstream" component (has dependencies) as the failing one
  const failingComp = architecture.find((c) => (c.dependsOnComponentIds ?? []).length > 0)
    ?? architecture[architecture.length - 1]
  const sourceComp = architecture.find((c) => c.id !== failingComp.id) ?? architecture[0]
  const rule = businessRules[0]

  const targetComponents = [failingComp, sourceComp]
  const targetFiles = importantFiles.filter((f) =>
    (failingComp.fileIds ?? []).includes(f.id) || (sourceComp.fileIds ?? []).includes(f.id)
  ).slice(0, 4)

  const expectedFindings = [
    `The execution path enters via ${sourceComp.name}`,
    `${failingComp.name} is the component where the problem manifests`,
    ...(rule ? [`The business rule "${rule.title}" may be violated`] : []),
    ...(failingComp.responsibilities[0] ? [`${failingComp.name} is responsible for: ${failingComp.responsibilities[0]}`] : []),
  ]

  return {
    id: 'inv-generated',
    title: `Unexpected behaviour in ${projectSummary.name}`,
    prompt: `A developer reports that ${failingComp.name} is not behaving as expected. Specifically, something in its "${failingComp.responsibilities[0] ?? 'core function'}" is producing incorrect results.`,
    context: `You have access to the codebase map you built in previous stages. Identify the likely execution path, the component(s) involved, and provide your reasoning.`,
    targetComponents,
    targetFiles,
    relatedRule: rule,
    hints: [
      `Start by identifying which component feeds data into ${failingComp.name}.`,
      ...(rule ? [`Consider whether the rule "${rule.title}" is being respected.`] : []),
      `Look at the responsibilities of each component you identified.`,
    ],
    expectedFindings,
  }
}

// ---------------------------------------------------------------------------
// Change Impact Scenario
// ---------------------------------------------------------------------------

export interface BuiltChangeScenario {
  id: string
  title: string
  changeDescription: string
  context: string
  /** Components the developer should identify as affected */
  affectedComponents: ArchitectureComponent[]
  affectedFiles: RepositoryFile[]
  risks: string[]
  testingNotes: string[]
  expectedImpactPoints: string[]
}

export function buildChangeScenario(analysis: RepositoryAnalysis): BuiltChangeScenario | null {
  const { architecture, importantFiles, testing, dependencies } = analysis
  if (architecture.length < 2) return null

  // Pick a "shared" component — one that others depend on
  const sharedComp = architecture.find((c) =>
    architecture.some((other) => (other.dependsOnComponentIds ?? []).includes(c.id))
  ) ?? architecture[architecture.length - 1]

  const dependents = architecture.filter((c) =>
    (c.dependsOnComponentIds ?? []).includes(sharedComp.id)
  )
  const allAffected = [sharedComp, ...dependents]

  const affectedFiles = importantFiles.filter((f) =>
    allAffected.some((c) => (c.fileIds ?? []).includes(f.id))
  )
  const testFiles = importantFiles.filter((f) => f.isTest)

  const risks = [
    `Components that depend on ${sharedComp.name} (${dependents.map((d) => d.name).join(', ') || 'none identified'}) may break.`,
    `Existing tests covering ${sharedComp.name} behaviour will need updating.`,
    ...(dependencies.filter((d) => !d.isDevelopmentOnly).length > 0
      ? [`Third-party integrations relying on this behaviour could be affected.`]
      : []),
  ]

  const testingNotes = [
    ...(testing.frameworks ?? []).length > 0
      ? [`Run: ${(testing.commands ?? ['your test command'])[0]}`]
      : ['Run the project\'s test suite.'],
    `Focus on tests that cover ${sharedComp.name} directly.`,
    ...(testFiles.length > 0 ? [`Key test files: ${testFiles.map((f) => f.path).join(', ')}`] : []),
  ]

  const expectedImpactPoints = [
    `${sharedComp.name} is the component being changed`,
    ...dependents.map((d) => `${d.name} depends on ${sharedComp.name} and will be affected`),
    `Files in ${sharedComp.name}: ${(sharedComp.fileIds ?? []).slice(0, 2).join(', ') || 'see component'}`,
  ]

  return {
    id: 'change-generated',
    title: `Modify ${sharedComp.name}`,
    changeDescription: `A new requirement asks you to change the behaviour of "${sharedComp.responsibilities[0] ?? 'a core function'}" in the ${sharedComp.name} component.`,
    context: `Use your architecture map to predict the impact of this change before writing any code.`,
    affectedComponents: allAffected,
    affectedFiles,
    risks,
    testingNotes,
    expectedImpactPoints,
  }
}

// ---------------------------------------------------------------------------
// Contribution Task
// ---------------------------------------------------------------------------

export interface ContributionFile {
  path: string
  role?: string
  relevance: string
}

export interface BuiltContributionTask {
  id: string
  title: string
  description: string
  /** The feature/behaviour being added or extended */
  targetBehaviour: string
  /** Components the developer should touch */
  targetComponents: ArchitectureComponent[]
  /** Files worth investigating before starting */
  filesToInvestigate: ContributionFile[]
  /** Behaviour that already exists and must be understood */
  existingBehaviourPoints: string[]
  /** High-level proposed changes */
  proposedChanges: string[]
  /** Tests to add or modify */
  testingSuggestions: string[]
  /** What "done" looks like */
  acceptanceCriteria: string[]
}

/**
 * Derives a realistic contribution task from the existing RepositoryAnalysis.
 * Picks a meaningful component with clear responsibilities and frames a
 * "add a new behaviour to an existing feature" scenario.
 * No AI calls.
 */
export function buildContributionTask(analysis: RepositoryAnalysis): BuiltContributionTask | null {
  const { architecture, importantFiles, testing, businessRules, keyConcepts, projectSummary } = analysis
  if (architecture.length < 1) return null

  // Pick the component with the most responsibilities — it is the richest target
  const sortedByResp = [...architecture].sort(
    (a, b) => b.responsibilities.length - a.responsibilities.length
  )
  const primaryComp = sortedByResp[0]
  const secondaryComp = sortedByResp.find((c) => c.id !== primaryComp.id)

  // Files linked to the primary component
  const compFiles = importantFiles.filter((f) =>
    (primaryComp.fileIds ?? []).includes(f.id)
  )
  const testFiles = importantFiles.filter((f) => f.isTest)
  const docFiles  = importantFiles.filter((f) => f.isDocumentation)

  const filesToInvestigate: ContributionFile[] = [
    ...compFiles.slice(0, 3).map((f) => ({
      path: f.path,
      role: f.role,
      relevance: `Core file for ${primaryComp.name}`,
    })),
    ...testFiles.slice(0, 2).map((f) => ({
      path: f.path,
      role: 'test',
      relevance: 'Understand existing test patterns',
    })),
    ...docFiles.slice(0, 1).map((f) => ({
      path: f.path,
      role: 'documentation',
      relevance: 'Understand conventions and constraints',
    })),
  ]

  const existingBehaviourPoints = [
    ...primaryComp.responsibilities.slice(0, 3).map(
      (r) => `${primaryComp.name} currently handles: ${r}`
    ),
    ...(businessRules[0]
      ? [`Business rule "${businessRules[0].title}" governs this area: ${businessRules[0].description}`]
      : []),
    ...(keyConcepts[0]
      ? [`Key concept "${keyConcepts[0].name}": ${keyConcepts[0].description}`]
      : []),
  ]

  const targetBehaviour = primaryComp.responsibilities[0] ?? 'core functionality'

  const proposedChanges = [
    `Extend ${primaryComp.name} to support an additional case within "${targetBehaviour}"`,
    ...(secondaryComp
      ? [`Update ${secondaryComp.name} to handle the new output from ${primaryComp.name}`]
      : []),
    `Add any new constants, types, or interfaces needed to represent the new behaviour`,
    ...(businessRules[0]
      ? [`Ensure the change complies with "${businessRules[0].title}"`]
      : []),
  ]

  const testingNotes = testing.frameworks ?? []
  const testCommands = testing.commands ?? []

  const testingSuggestions = [
    `Write a unit test for the new behaviour inside ${primaryComp.name}`,
    ...(testFiles.length > 0
      ? [`Add tests alongside existing test files: ${testFiles.map((f) => f.path).join(', ')}`]
      : ['Add tests following the project\'s existing test structure']),
    ...(testCommands.length > 0
      ? [`Run the suite with: ${testCommands[0]}`]
      : []),
    ...(testingNotes.length > 0
      ? [`Testing framework in use: ${testingNotes.join(', ')}`]
      : []),
  ]

  const acceptanceCriteria = [
    `The new behaviour is covered by at least one test`,
    `Existing tests continue to pass`,
    `The change is isolated to ${primaryComp.name}${secondaryComp ? ` and ${secondaryComp.name}` : ''}`,
    `Code follows the conventions already present in the codebase`,
  ]

  return {
    id: 'contribution-generated',
    title: `Extend ${primaryComp.name} in ${projectSummary.name}`,
    description: `Add a new behaviour to an existing feature in ${projectSummary.name}. This task asks you to plan — not write — a real change, demonstrating that you understand the code well enough to propose a reviewable approach.`,
    targetBehaviour,
    targetComponents: [primaryComp, ...(secondaryComp ? [secondaryComp] : [])],
    filesToInvestigate,
    existingBehaviourPoints,
    proposedChanges,
    testingSuggestions,
    acceptanceCriteria,
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
