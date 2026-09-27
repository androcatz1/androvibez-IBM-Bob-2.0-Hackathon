/**
 * AI response parser and validator.
 *
 * The model returns a JSON string. This module:
 *   1. Extracts JSON from the response (stripping markdown fences if present)
 *   2. Parses and type-checks the payload
 *   3. Fills in required fields that the model may have omitted
 *   4. Ensures all cross-referenced IDs are internally consistent
 *
 * Validation is lenient: we prefer a partial analysis over a hard failure.
 * Structural problems are recorded in RepositoryAnalysis.warnings.
 */

import type {
  RepositoryAnalysis,
  ProjectSummary,
  ArchitectureComponent,
  RepositoryFile,
  Dependency,
  BusinessRule,
  KeyConcept,
  LearningObjective,
  TestingStructure,
  DocumentationMap,
  Quest,
  OnboardingPath,
} from '../../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((item): item is string => typeof item === 'string')
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : fallback
}

function asBoolean(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined
}

/** Generate a stable ID from arbitrary text if the model forgot to include one. */
function slugId(prefix: string, text: string, index: number): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${prefix}-${slug || String(index)}`
}

// ---------------------------------------------------------------------------
// JSON extraction
// ---------------------------------------------------------------------------

/**
 * Attempts to extract a JSON object from the model's raw text response.
 * Models sometimes wrap their answer in markdown code fences despite being
 * instructed not to.
 */
function extractJson(raw: string): string {
  // Strip leading/trailing whitespace
  let text = raw.trim()

  // Remove ```json ... ``` or ``` ... ``` fences
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fenceMatch) return fenceMatch[1]

  // Try to find the outermost { } block if there's extra prose around it
  const firstBrace = text.indexOf('{')
  const lastBrace  = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1)
  }

  return text
}

// ---------------------------------------------------------------------------
// Field-level parsers
// ---------------------------------------------------------------------------

function parseProjectSummary(raw: unknown, name: string): ProjectSummary {
  if (!isObject(raw)) {
    return { name, technologies: [] }
  }
  return {
    name: asString(raw.name, name),
    description: asString(raw.description) || undefined,
    purpose: asString(raw.purpose) || undefined,
    projectType: asString(raw.projectType) || undefined,
    maturity: asString(raw.maturity) || undefined,
    technologies: asStringArray(raw.technologies),
    domains: asStringArray(raw.domains).length > 0 ? asStringArray(raw.domains) : undefined,
    audiences: asStringArray(raw.audiences).length > 0 ? asStringArray(raw.audiences) : undefined,
  }
}

function parseArchitecture(raw: unknown, warnings: string[]): ArchitectureComponent[] {
  const items = asArray(raw)
  return items.flatMap((item, i) => {
    if (!isObject(item)) {
      warnings.push(`architecture[${i}]: not an object, skipped`)
      return []
    }
    const id = asString(item.id) || slugId('comp', asString(item.name), i)
    return [{
      id,
      name: asString(item.name, `Component ${i + 1}`),
      type: asString(item.type, 'unknown'),
      description: asString(item.description) || undefined,
      responsibilities: asStringArray(item.responsibilities),
      fileIds: asStringArray(item.fileIds).length > 0 ? asStringArray(item.fileIds) : undefined,
      dependsOnComponentIds: asStringArray(item.dependsOnComponentIds).length > 0 ? asStringArray(item.dependsOnComponentIds) : undefined,
    }]
  })
}

function parseImportantFiles(raw: unknown, warnings: string[]): RepositoryFile[] {
  const items = asArray(raw)
  return items.flatMap((item, i) => {
    if (!isObject(item)) {
      warnings.push(`importantFiles[${i}]: not an object, skipped`)
      return []
    }
    const path = asString(item.path)
    const name = asString(item.name) || path.split('/').pop() || `file-${i}`
    const id   = asString(item.id) || `file-${path.replace(/[^a-z0-9]/gi, '-')}`
    return [{
      id,
      path: path || `unknown-${i}`,
      name,
      extension: asString(item.extension) || undefined,
      language: asString(item.language) || undefined,
      role: asString(item.role) || undefined,
      summary: asString(item.summary) || undefined,
      isEntryPoint: asBoolean(item.isEntryPoint),
      isTest: asBoolean(item.isTest),
      isDocumentation: asBoolean(item.isDocumentation),
    }]
  })
}

function parseDependencies(raw: unknown): Dependency[] {
  const items = asArray(raw)
  return items.flatMap((item, i) => {
    if (!isObject(item)) return []
    const name = asString(item.name)
    if (!name) return []
    return [{
      id: asString(item.id) || slugId('dep', name, i),
      name,
      version: asString(item.version) || undefined,
      ecosystem: asString(item.ecosystem) || undefined,
      category: asString(item.category) || undefined,
      purpose: asString(item.purpose) || undefined,
      isDevelopmentOnly: asBoolean(item.isDevelopmentOnly),
    }]
  })
}

function parseBusinessRules(raw: unknown): BusinessRule[] {
  const items = asArray(raw)
  return items.flatMap((item, i) => {
    if (!isObject(item)) return []
    return [{
      id: asString(item.id) || slugId('rule', asString(item.title), i),
      title: asString(item.title, `Rule ${i + 1}`),
      description: asString(item.description, ''),
      sourceFileIds: asStringArray(item.sourceFileIds).length > 0 ? asStringArray(item.sourceFileIds) : undefined,
      domain: asString(item.domain) || undefined,
      confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
    }]
  })
}

function parseKeyConcepts(raw: unknown): KeyConcept[] {
  const items = asArray(raw)
  return items.flatMap((item, i) => {
    if (!isObject(item)) return []
    return [{
      id: asString(item.id) || slugId('concept', asString(item.name), i),
      name: asString(item.name, `Concept ${i + 1}`),
      description: asString(item.description, ''),
      relatedFileIds: asStringArray(item.relatedFileIds).length > 0 ? asStringArray(item.relatedFileIds) : undefined,
      relatedComponentIds: asStringArray(item.relatedComponentIds).length > 0 ? asStringArray(item.relatedComponentIds) : undefined,
      relatedConceptIds: asStringArray(item.relatedConceptIds).length > 0 ? asStringArray(item.relatedConceptIds) : undefined,
    }]
  })
}

function parseLearningObjectives(raw: unknown): LearningObjective[] {
  const items = asArray(raw)
  const VALID_LEVELS = new Set(['introductory', 'intermediate', 'advanced'])
  return items.flatMap((item, i) => {
    if (!isObject(item)) return []
    const level = asString(item.level)
    return [{
      id: asString(item.id) || slugId('obj', asString(item.title), i),
      title: asString(item.title, `Objective ${i + 1}`),
      description: asString(item.description, ''),
      level: VALID_LEVELS.has(level) ? (level as LearningObjective['level']) : undefined,
      prerequisiteObjectiveIds: asStringArray(item.prerequisiteObjectiveIds).length > 0 ? asStringArray(item.prerequisiteObjectiveIds) : undefined,
      relatedConceptIds: asStringArray(item.relatedConceptIds).length > 0 ? asStringArray(item.relatedConceptIds) : undefined,
      measurableOutcomes: asStringArray(item.measurableOutcomes).length > 0 ? asStringArray(item.measurableOutcomes) : undefined,
    }]
  })
}

function parseTesting(raw: unknown): TestingStructure {
  if (!isObject(raw)) return {}
  return {
    frameworks: asStringArray(raw.frameworks).length > 0 ? asStringArray(raw.frameworks) : undefined,
    testLocations: asStringArray(raw.testLocations).length > 0 ? asStringArray(raw.testLocations) : undefined,
    conventions: asStringArray(raw.conventions).length > 0 ? asStringArray(raw.conventions) : undefined,
    commands: asStringArray(raw.commands).length > 0 ? asStringArray(raw.commands) : undefined,
    coverageNotes: asString(raw.coverageNotes) || undefined,
  }
}

function parseDocumentation(raw: unknown): DocumentationMap {
  if (!isObject(raw)) return {}
  return {
    fileIds: asStringArray(raw.fileIds).length > 0 ? asStringArray(raw.fileIds) : undefined,
    guides: asStringArray(raw.guides).length > 0 ? asStringArray(raw.guides) : undefined,
    missingTopics: asStringArray(raw.missingTopics).length > 0 ? asStringArray(raw.missingTopics) : undefined,
    conventions: asStringArray(raw.conventions).length > 0 ? asStringArray(raw.conventions) : undefined,
  }
}

function parseQuestStep(raw: unknown, questId: string, index: number) {
  if (!isObject(raw)) return null
  return {
    id: asString(raw.id) || `${questId}-step-${index + 1}`,
    title: asString(raw.title, `Step ${index + 1}`),
    description: asString(raw.description, ''),
    instructions: asStringArray(raw.instructions).length > 0 ? asStringArray(raw.instructions) : undefined,
    relatedFileIds: asStringArray(raw.relatedFileIds).length > 0 ? asStringArray(raw.relatedFileIds) : undefined,
    relatedConceptIds: asStringArray(raw.relatedConceptIds).length > 0 ? asStringArray(raw.relatedConceptIds) : undefined,
    relatedComponentIds: asStringArray(raw.relatedComponentIds).length > 0 ? asStringArray(raw.relatedComponentIds) : undefined,
    estimatedMinutes: typeof raw.estimatedMinutes === 'number' ? raw.estimatedMinutes : undefined,
  }
}

function parseQuests(raw: unknown, warnings: string[]): Quest[] {
  const items = asArray(raw)
  const VALID_LEVELS = new Set(['introductory', 'intermediate', 'advanced'])
  return items.flatMap((item, i) => {
    if (!isObject(item)) {
      warnings.push(`quests[${i}]: not an object, skipped`)
      return []
    }
    const id = asString(item.id) || slugId('quest', asString(item.title), i)
    const difficulty = asString(item.difficulty)
    const steps = asArray(item.steps)
      .map((s, si) => parseQuestStep(s, id, si))
      .filter((s): s is NonNullable<typeof s> => s !== null)
    return [{
      id,
      title: asString(item.title, `Quest ${i + 1}`),
      description: asString(item.description, ''),
      objectiveIds: asStringArray(item.objectiveIds),
      type: asString(item.type, 'orientation'),
      difficulty: VALID_LEVELS.has(difficulty) ? (difficulty as Quest['difficulty']) : undefined,
      estimatedMinutes: asNumber(item.estimatedMinutes, 0) || undefined,
      prerequisites: asStringArray(item.prerequisites).length > 0 ? asStringArray(item.prerequisites) : undefined,
      steps,
      tags: asStringArray(item.tags).length > 0 ? asStringArray(item.tags) : undefined,
    }]
  })
}

function parseOnboardingPath(raw: unknown, quests: Quest[], objectives: LearningObjective[]): OnboardingPath {
  const totalMinutes = quests.reduce((sum, q) => sum + (q.estimatedMinutes ?? 0), 0)
  if (!isObject(raw)) {
    return {
      id: 'path-default',
      title: 'Core developer onboarding',
      objectiveIds: objectives.map((o) => o.id),
      questIds: quests.map((q) => q.id),
      estimatedMinutes: totalMinutes || undefined,
      version: 1,
    }
  }
  return {
    id: asString(raw.id, 'path-default'),
    title: asString(raw.title, 'Core developer onboarding'),
    description: asString(raw.description) || undefined,
    objectiveIds: asStringArray(raw.objectiveIds).length > 0 ? asStringArray(raw.objectiveIds) : objectives.map((o) => o.id),
    questIds: asStringArray(raw.questIds).length > 0 ? asStringArray(raw.questIds) : quests.map((q) => q.id),
    estimatedMinutes: asNumber(raw.estimatedMinutes, 0) || totalMinutes || undefined,
    version: 1,
  }
}

// ---------------------------------------------------------------------------
// ID consistency checker
// ---------------------------------------------------------------------------

/**
 * Logs warnings for dangling ID references.
 * Does not remove them — the UI can silently ignore unknown IDs.
 */
function checkIdConsistency(analysis: RepositoryAnalysis, warnings: string[]): void {
  const fileIds   = new Set(analysis.importantFiles.map((f) => f.id))
  const compIds   = new Set(analysis.architecture.map((c) => c.id))
  const objIds    = new Set(analysis.learningObjectives.map((o) => o.id))
  const questIds  = new Set(analysis.quests.map((q) => q.id))

  function check(label: string, ids: string[], validSet: Set<string>) {
    for (const id of ids) {
      if (!validSet.has(id)) {
        warnings.push(`${label}: unknown ID "${id}"`)
      }
    }
  }

  for (const comp of analysis.architecture) {
    check(`architecture[${comp.id}].fileIds`, comp.fileIds ?? [], fileIds)
    check(`architecture[${comp.id}].dependsOnComponentIds`, comp.dependsOnComponentIds ?? [], compIds)
  }

  for (const concept of analysis.keyConcepts) {
    check(`keyConcept[${concept.id}].relatedFileIds`, concept.relatedFileIds ?? [], fileIds)
    check(`keyConcept[${concept.id}].relatedComponentIds`, concept.relatedComponentIds ?? [], compIds)
  }

  for (const obj of analysis.learningObjectives) {
    check(`objective[${obj.id}].prerequisiteObjectiveIds`, obj.prerequisiteObjectiveIds ?? [], objIds)
  }

  for (const quest of analysis.quests) {
    check(`quest[${quest.id}].objectiveIds`, quest.objectiveIds, objIds)
    check(`quest[${quest.id}].prerequisites`, quest.prerequisites ?? [], questIds)
    for (const step of quest.steps) {
      check(`quest[${quest.id}].step[${step.id}].relatedFileIds`, step.relatedFileIds ?? [], fileIds)
      check(`quest[${quest.id}].step[${step.id}].relatedComponentIds`, step.relatedComponentIds ?? [], compIds)
    }
  }

  check('onboardingPath.questIds', analysis.onboardingPath?.questIds ?? [], questIds)
  check('onboardingPath.objectiveIds', analysis.onboardingPath?.objectiveIds ?? [], objIds)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ParsedAnalysisResponse {
  analysis: RepositoryAnalysis
  /** Warnings encountered during parsing; does not indicate a failure. */
  parseWarnings: string[]
}

/**
 * Parse the raw LLM response text into a typed RepositoryAnalysis.
 *
 * @param rawResponse   The text content returned by the AI model.
 * @param repositoryId  ID of the repository being analysed.
 * @param repoName      Human-readable name of the repository.
 * @throws              If the response cannot be parsed as JSON at all.
 */
export function parseAnalysisResponse(
  rawResponse: string,
  repositoryId: string,
  repoName: string,
): ParsedAnalysisResponse {
  const parseWarnings: string[] = []

  const jsonText = extractJson(rawResponse)
  let raw: Record<string, unknown>
  try {
    const parsed = JSON.parse(jsonText) as unknown
    if (!isObject(parsed)) throw new Error('Response is not a JSON object')
    raw = parsed
  } catch (e) {
    throw new Error(
      `AI response could not be parsed as JSON: ${e instanceof Error ? e.message : String(e)}`
    )
  }

  // Parse each section
  const projectSummary  = parseProjectSummary(raw.projectSummary, repoName)
  const architecture    = parseArchitecture(raw.architecture, parseWarnings)
  const importantFiles  = parseImportantFiles(raw.importantFiles, parseWarnings)
  const dependencies    = parseDependencies(raw.dependencies)
  const businessRules   = parseBusinessRules(raw.businessRules)
  const keyConcepts     = parseKeyConcepts(raw.keyConcepts)
  const learningObjectives = parseLearningObjectives(raw.learningObjectives)
  const testing         = parseTesting(raw.testing)
  const documentation   = parseDocumentation(raw.documentation)
  const technologies    = asStringArray(raw.technologies).length > 0
    ? asStringArray(raw.technologies)
    : projectSummary.technologies
  const quests          = parseQuests(raw.quests, parseWarnings)
  const onboardingPath  = parseOnboardingPath(raw.onboardingPath, quests, learningObjectives)
  const modelWarnings   = asStringArray(raw.warnings)

  const analysis: RepositoryAnalysis = {
    id: `analysis-${Date.now()}`,
    repositoryId,
    version: 1,
    generatedAt: new Date().toISOString(),
    projectSummary,
    technologies,
    architecture,
    importantFiles,
    dependencies,
    businessRules,
    keyConcepts,
    testing,
    documentation,
    learningObjectives,
    quests,
    onboardingPath,
    warnings: [...modelWarnings, ...parseWarnings].length > 0
      ? [...modelWarnings, ...parseWarnings]
      : undefined,
  }

  // Non-fatal consistency check
  checkIdConsistency(analysis, parseWarnings)

  return { analysis, parseWarnings }
}
