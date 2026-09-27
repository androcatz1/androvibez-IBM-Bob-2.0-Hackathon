export type ID = string
export type ISODateString = string

export type RepositorySource = 'local' | 'remote' | 'archive' | 'unknown'
export type RepositoryStatus = 'connected' | 'analyzing' | 'ready' | 'error'
export type RepositoryInputKind = 'demo' | 'zip'
export type QuestStatus = 'locked' | 'available' | 'in-progress' | 'completed'
export type Difficulty = 'introductory' | 'intermediate' | 'advanced'

export interface Repository {
  id: ID
  name: string
  source: RepositorySource
  location?: string
  url?: string
  defaultBranch?: string
  status: RepositoryStatus
  analysisId?: ID
  createdAt: ISODateString
  updatedAt: ISODateString
  metadata?: Record<string, unknown>
}

export interface RepositoryInput {
  kind: RepositoryInputKind
  name: string
  archive?: File
  files?: RepositoryFile[]
  metadata?: Record<string, unknown>
}

export interface RepositoryAnalysisRequest {
  repository: Repository
  input: RepositoryInput
  /** Pre-parsed repository. If supplied, the service skips the parse step. */
  parsedRepo?: unknown
}

export interface RepositoryFile {
  id: ID
  path: string
  name: string
  extension?: string
  language?: string
  sizeBytes?: number
  role?: string
  summary?: string
  isEntryPoint?: boolean
  isTest?: boolean
  isDocumentation?: boolean
  /** Inline file content — used by demo/static inputs to supply content to the AI parser. */
  content?: string
  metadata?: Record<string, unknown>
}

export interface ProjectSummary {
  name: string
  description?: string
  purpose?: string
  projectType?: string
  maturity?: string
  technologies: string[]
  domains?: string[]
  audiences?: string[]
}

export interface ArchitectureComponent {
  id: ID
  name: string
  type: string
  description?: string
  responsibilities: string[]
  fileIds?: ID[]
  dependsOnComponentIds?: ID[]
  metadata?: Record<string, unknown>
}

export interface Dependency {
  id: ID
  name: string
  version?: string
  ecosystem?: string
  category?: string
  purpose?: string
  isDevelopmentOnly?: boolean
  relatedFileIds?: ID[]
}

export interface BusinessRule {
  id: ID
  title: string
  description: string
  sourceFileIds?: ID[]
  domain?: string
  confidence?: number
}

export interface KeyConcept {
  id: ID
  name: string
  description: string
  relatedFileIds?: ID[]
  relatedComponentIds?: ID[]
  relatedConceptIds?: ID[]
}

export interface LearningObjective {
  id: ID
  title: string
  description: string
  level?: Difficulty
  prerequisiteObjectiveIds?: ID[]
  relatedConceptIds?: ID[]
  measurableOutcomes?: string[]
}

export interface TestingStructure {
  frameworks?: string[]
  testLocations?: string[]
  conventions?: string[]
  commands?: string[]
  coverageNotes?: string
}

export interface DocumentationMap {
  fileIds?: ID[]
  guides?: string[]
  missingTopics?: string[]
  conventions?: string[]
}

export interface RepositoryAnalysis {
  id: ID
  repositoryId: ID
  version: number
  generatedAt: ISODateString
  projectSummary: ProjectSummary
  technologies: string[]
  architecture: ArchitectureComponent[]
  importantFiles: RepositoryFile[]
  files?: RepositoryFile[]
  dependencies: Dependency[]
  businessRules: BusinessRule[]
  keyConcepts: KeyConcept[]
  testing: TestingStructure
  documentation: DocumentationMap
  learningObjectives: LearningObjective[]
  quests: Quest[]
  onboardingPath?: OnboardingPath
  warnings?: string[]
  metadata?: Record<string, unknown>
}

export interface QuestStep {
  id: ID
  title: string
  description: string
  instructions?: string[]
  relatedFileIds?: ID[]
  relatedConceptIds?: ID[]
  relatedComponentIds?: ID[]
  estimatedMinutes?: number
}

export interface Quest {
  id: ID
  title: string
  description: string
  objectiveIds: ID[]
  type: string
  difficulty?: Difficulty
  status?: QuestStatus
  estimatedMinutes?: number
  prerequisites?: ID[]
  steps: QuestStep[]
  quizQuestionIds?: ID[]
  investigationScenarioIds?: ID[]
  changeImpactScenarioIds?: ID[]
  contributionTaskIds?: ID[]
  tags?: string[]
}

export interface QuizAnswer {
  id: ID
  text: string
  isCorrect?: boolean
  explanation?: string
}

export interface QuizQuestion {
  id: ID
  prompt: string
  type: 'single-choice' | 'multiple-choice' | 'free-response' | 'true-false'
  answers?: QuizAnswer[]
  correctAnswerIds?: ID[]
  explanation?: string
  objectiveIds?: ID[]
  relatedFileIds?: ID[]
}

export interface InvestigationScenario {
  id: ID
  title: string
  prompt: string
  context?: string
  expectedFindings?: string[]
  hint?: string
  relatedFileIds?: ID[]
  objectiveIds?: ID[]
}

export interface ChangeImpactScenario {
  id: ID
  title: string
  changeDescription: string
  affectedComponentIds?: ID[]
  affectedFileIds?: ID[]
  risks?: string[]
  validationSteps?: string[]
  objectiveIds?: ID[]
}

export interface ContributionTask {
  id: ID
  title: string
  description: string
  acceptanceCriteria?: string[]
  suggestedFileIds?: ID[]
  relatedObjectiveIds?: ID[]
  difficulty?: Difficulty
  status?: 'not-started' | 'in-progress' | 'submitted' | 'complete'
}

export interface QuestResult {
  questId: ID
  status: 'passed' | 'needs-review' | 'incomplete'
  score?: number
  completedStepIds?: ID[]
  feedback?: string
  knowledgeGapIds?: ID[]
  completedAt?: ISODateString
}

export interface KnowledgeGap {
  id: ID
  topic: string
  description: string
  objectiveIds?: ID[]
  sourceQuestIds?: ID[]
  severity?: 'low' | 'medium' | 'high'
  recommendedQuestIds?: ID[]
}

export interface UserProgress {
  userId: ID
  repositoryId: ID
  currentQuestId?: ID
  completedQuestIds: ID[]
  questResults: QuestResult[]
  knowledgeGaps: KnowledgeGap[]
  completedObjectiveIds: ID[]
  completionPercent: number
  lastActivityAt?: ISODateString
  startedAt: ISODateString
}

export interface OnboardingPath {
  id: ID
  title: string
  description?: string
  objectiveIds: ID[]
  questIds: ID[]
  estimatedMinutes?: number
  version?: number
}
