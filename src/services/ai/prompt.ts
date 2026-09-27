/**
 * Prompt builder for the AI repository-understanding pass.
 *
 * Converts a ParsedRepository (produced by RepositoryParser) into a pair of
 * messages — system + user — suitable for any chat-completion model.
 *
 * Design goals:
 *   - The prompt asks the model to reason about what a NEW DEVELOPER needs to
 *     understand, not to summarise files.
 *   - All repository content is derived from the ParsedRepository; nothing
 *     about a specific project is hard-coded here.
 *   - The expected output is a single JSON object matching the RepositoryAnalysis
 *     schema defined in src/types/index.ts.
 *   - IDs embedded in the JSON must be consistent (used to link concepts,
 *     files, components, and objectives together).
 */

import type { ParsedRepository, DirectoryNode, ClassifiedFile } from '../repository-analysis/types'

// ---------------------------------------------------------------------------
// Directory tree serialiser
// ---------------------------------------------------------------------------

function renderTree(nodes: DirectoryNode[], indent = 0): string {
  const lines: string[] = []
  const pad = '  '.repeat(indent)
  for (const node of nodes) {
    const suffix = node.type === 'directory' ? '/' : node.language ? ` [${node.language}${node.role ? `, ${node.role}` : ''}]` : node.role ? ` [${node.role}]` : ''
    lines.push(`${pad}${node.name}${suffix}`)
    if (node.children && node.children.length > 0) {
      lines.push(renderTree(node.children, indent + 1))
    }
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// File content block serialiser
// ---------------------------------------------------------------------------

function renderFileContents(files: ClassifiedFile[]): string {
  if (files.length === 0) return '(no file contents available within token budget)'

  return files
    .map((f) => {
      const header = `=== ${f.path} [${f.language ?? 'unknown language'}, ${f.role ?? 'unknown role'}] ===`
      return `${header}\n${f.content ?? '(no content)'}`
    })
    .join('\n\n')
}

// ---------------------------------------------------------------------------
// Dependency list serialiser
// ---------------------------------------------------------------------------

function renderDependencies(parsed: ParsedRepository): string {
  const allDeps = parsed.manifests.flatMap((m) => m.dependencies)
  if (allDeps.length === 0) return 'None detected'

  const prod = allDeps.filter((d) => !d.isDevelopmentOnly)
  const dev  = allDeps.filter((d) => d.isDevelopmentOnly)

  const lines: string[] = []
  if (prod.length > 0) {
    lines.push(`Production (${prod.length}): ${prod.slice(0, 25).map((d) => `${d.name}${d.version ? `@${d.version}` : ''}`).join(', ')}${prod.length > 25 ? ` … +${prod.length - 25} more` : ''}`)
  }
  if (dev.length > 0) {
    lines.push(`Development (${dev.length}): ${dev.slice(0, 15).map((d) => d.name).join(', ')}${dev.length > 15 ? ` … +${dev.length - 15} more` : ''}`)
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Schema description embedded in the system prompt
// ---------------------------------------------------------------------------

const SCHEMA_DESCRIPTION = `
You must respond with a single JSON object. Do not include markdown fences, explanations, or any text outside the JSON object.

The JSON object must conform to this TypeScript schema (all fields marked with ? are optional):

{
  "projectSummary": {
    "name": string,
    "description"?: string,
    "purpose"?: string,
    "projectType"?: string,        // e.g. "Web application", "CLI tool", "Library", "Microservice"
    "maturity"?: string,           // e.g. "Early-stage", "Production", "Mature"
    "technologies": string[],      // top 5-8 technologies
    "domains"?: string[],          // business domains (e.g. ["E-commerce", "Payments"])
    "audiences"?: string[]         // intended users of the system
  },
  "technologies": string[],        // same as projectSummary.technologies
  "architecture": [                // 3-8 major architectural components
    {
      "id": string,                // stable kebab-case ID (e.g. "comp-api-layer")
      "name": string,
      "type": string,              // e.g. "entry-point", "business-logic", "data-access", "integration", "presentation"
      "description"?: string,
      "responsibilities": string[],
      "fileIds"?: string[],        // IDs from importantFiles
      "dependsOnComponentIds"?: string[]
    }
  ],
  "importantFiles": [             // 5-15 files a new developer must know
    {
      "id": string,               // use file IDs from the provided file list where possible
      "path": string,
      "name": string,
      "extension"?: string,
      "language"?: string,
      "role"?: string,
      "summary"?: string,         // one sentence explaining WHY this file matters
      "isEntryPoint"?: boolean,
      "isTest"?: boolean,
      "isDocumentation"?: boolean
    }
  ],
  "dependencies": [               // key runtime dependencies (skip dev-only build tools)
    {
      "id": string,               // "dep-" + kebab-case name
      "name": string,
      "version"?: string,
      "ecosystem"?: string,
      "category"?: string,        // "framework", "database", "auth", "testing", "tooling", etc.
      "purpose"?: string,
      "isDevelopmentOnly"?: boolean
    }
  ],
  "businessRules": [              // 3-8 domain/business rules the code enforces
    {
      "id": string,               // "rule-" + kebab-case
      "title": string,
      "description": string,
      "sourceFileIds"?: string[],
      "domain"?: string,
      "confidence"?: number       // 0.0 – 1.0; how certain you are this is intentional
    }
  ],
  "keyConcepts": [                // 5-12 concepts a new developer must understand
    {
      "id": string,               // "concept-" + kebab-case
      "name": string,
      "description": string,      // 2-4 sentences: what it is, why it exists, where it appears
      "relatedFileIds"?: string[],
      "relatedComponentIds"?: string[],
      "relatedConceptIds"?: string[]
    }
  ],
  "testing": {
    "frameworks"?: string[],
    "testLocations"?: string[],   // relative paths to test directories/files
    "conventions"?: string[],     // naming patterns, file co-location rules
    "commands"?: string[],        // e.g. ["npm test", "pytest"]
    "coverageNotes"?: string
  },
  "documentation": {
    "fileIds"?: string[],         // IDs of documentation files in importantFiles
    "guides"?: string[],          // names of key guides present (e.g. "Setup guide", "API reference")
    "missingTopics"?: string[],   // topics that appear undocumented
    "conventions"?: string[]
  },
  "learningObjectives": [         // 4-8 ordered objectives for a new developer
    {
      "id": string,               // "obj-" + kebab-case
      "title": string,
      "description": string,
      "level"?: "introductory" | "intermediate" | "advanced",
      "prerequisiteObjectiveIds"?: string[],
      "relatedConceptIds"?: string[],
      "measurableOutcomes"?: string[]
    }
  ],
  "quests": [                     // 4-6 structured learning quests
    {
      "id": string,               // "quest-" + kebab-case
      "title": string,
      "description": string,
      "objectiveIds": string[],   // references learningObjectives[].id
      "type": string,             // "orientation" | "code-tracing" | "quality" | "change-impact" | "contribution" | "completion"
      "difficulty"?: "introductory" | "intermediate" | "advanced",
      "estimatedMinutes"?: number,
      "prerequisites"?: string[], // other quest IDs
      "steps": [
        {
          "id": string,
          "title": string,
          "description": string,
          "instructions"?: string[],
          "relatedFileIds"?: string[],
          "relatedConceptIds"?: string[],
          "relatedComponentIds"?: string[],
          "estimatedMinutes"?: number
        }
      ],
      "tags"?: string[]
    }
  ],
  "onboardingPath": {
    "id": "path-default",
    "title": string,
    "description"?: string,
    "objectiveIds": string[],
    "questIds": string[],
    "estimatedMinutes"?: number,
    "version": 1
  },
  "warnings"?: string[]           // anything odd you noticed about the repository
}
`.trim()

// ---------------------------------------------------------------------------
// System message
// ---------------------------------------------------------------------------

const SYSTEM_MESSAGE = `
You are an expert software engineer and technical educator performing a deep analysis of an unfamiliar codebase.

Your task is to produce a structured onboarding analysis that will guide a new developer through understanding this repository well enough to make their first contribution.

CRITICAL RULES:
1. Do NOT summarise individual files — instead, reason about the system as a whole.
2. Identify what a new developer actually needs to understand before contributing.
3. For every key concept, explain WHY it matters and WHERE it appears, not just what it is.
4. Point out patterns that commonly confuse new developers (e.g. non-obvious naming, unusual conventions, implicit coupling).
5. All IDs in your response must be consistent — a fileId referenced in a concept must match an id in importantFiles.
6. Do NOT hard-code assumptions about any specific project or technology not present in the provided context.
7. The quests you generate must be genuinely learnable from this specific repository — do not invent generic quests.
8. Respond ONLY with the JSON object described in the schema — no prose, no markdown fences.

${SCHEMA_DESCRIPTION}
`.trim()

// ---------------------------------------------------------------------------
// User message builder
// ---------------------------------------------------------------------------

export interface PromptContext {
  parsed: ParsedRepository
}

export interface BuiltPrompt {
  systemMessage: string
  userMessage: string
}

export function buildAnalysisPrompt(context: PromptContext): BuiltPrompt {
  const { parsed } = context

  const languages = parsed.detectedLanguages
    .map((l) => `${l.name} (${l.fileCount} files)`)
    .join(', ') || 'None detected'

  const scripts = parsed.manifests
    .flatMap((m) => Object.entries(m.scripts ?? {}))
    .slice(0, 10)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n') || '  (none)'

  const manifestSummary = parsed.manifests
    .map((m) => {
      const parts = [`[${m.ecosystem}] ${m.filePath}`]
      if (m.projectName) parts.push(`name=${m.projectName}`)
      if (m.version) parts.push(`version=${m.version}`)
      if (m.description) parts.push(`description="${m.description}"`)
      return parts.join(' ')
    })
    .join('\n') || '  (none)'

  const fileStats = {
    total: parsed.files.length,
    source: parsed.files.filter((f) => f.role === 'source').length,
    test: parsed.files.filter((f) => f.isTest).length,
    docs: parsed.files.filter((f) => f.isDocumentation).length,
    config: parsed.files.filter((f) => f.role === 'configuration').length,
    entryPoints: parsed.files.filter((f) => f.isEntryPoint).length,
  }

  const fileListForReference = parsed.files
    .slice(0, 80)
    .map((f) => `  ${f.id} → ${f.path}${f.language ? ` [${f.language}]` : ''}${f.role ? ` <${f.role}>` : ''}${f.isEntryPoint ? ' ENTRY' : ''}${f.isTest ? ' TEST' : ''}${f.isDocumentation ? ' DOC' : ''}`)
    .join('\n')

  const userMessage = `
# Repository: ${parsed.name}

## Statistics
- Total files: ${fileStats.total}
- Source files: ${fileStats.source}
- Test files: ${fileStats.test}
- Documentation files: ${fileStats.docs}
- Configuration files: ${fileStats.config}
- Entry points: ${fileStats.entryPoints}
- Estimated tokens in selected files: ${parsed.estimatedTokenCount.toLocaleString()}
${parsed.warnings.length > 0 ? `- Parser warnings: ${parsed.warnings.join('; ')}` : ''}

## Detected Languages
${languages}

## Manifests
${manifestSummary}

## Available Scripts / Commands
${scripts}

## Dependencies
${renderDependencies(parsed)}

## Directory Tree (top 3 levels, build/asset directories excluded)
${renderTree(parsed.directoryTree)}

## File Reference (for building IDs)
The following file IDs should be used when referencing files in your response.
${fileListForReference}
${parsed.files.length > 80 ? `\n  … and ${parsed.files.length - 80} more files not listed here.` : ''}

## Important File Contents (selected within token budget)
${renderFileContents(parsed.importantFiles)}

---

Produce the JSON analysis now. Remember:
- Explain what a NEW DEVELOPER needs to understand, not what files contain.
- Make the key concepts actionable and specific to THIS repository.
- Ensure all cross-referenced IDs are consistent.
- Generate quests that are genuinely discoverable from the code above.
`.trim()

  return {
    systemMessage: SYSTEM_MESSAGE,
    userMessage,
  }
}
