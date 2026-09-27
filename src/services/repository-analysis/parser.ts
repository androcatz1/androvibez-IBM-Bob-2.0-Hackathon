/**
 * RepositoryParser — orchestrates the full file → structured context pipeline.
 *
 * Pipeline:
 *   RepositoryInput
 *     → File discovery  (extract ZIP or use injected files)
 *     → File classification  (extension + path heuristics)
 *     → Metadata extraction  (manifest parsing, framework detection)
 *     → Content selection  (token-budget-aware file subset)
 *     → Fingerprint computation  (SHA-256 of path:size pairs)
 *     → ParsedRepository
 *
 * This module contains zero AI. It is the Repository Parsing Boundary
 * described in ARCHITECTURE.md §8.2.
 */

import type { RepositoryInput } from '../../types'
import { classifyFile, shouldIgnorePath } from './classifier'
import { extractZip, stripCommonPrefix } from './extractor'
import { extractManifest, detectFrameworks } from './metadata'
import { selectImportantFiles, buildDirectoryTree, estimateTokens, DEFAULT_TOKEN_BUDGET } from './selector'
import type { ClassifiedFile, DetectedLanguage, ParsedRepository } from './types'

// ---------------------------------------------------------------------------
// Fingerprint
// ---------------------------------------------------------------------------

/**
 * Compute a stable SHA-256 fingerprint of the repository.
 * Input: sorted "path:sizeBytes" pairs joined by newlines.
 */
async function computeFingerprint(files: ClassifiedFile[]): Promise<string> {
  const entries = files
    .map((f) => `${f.path}:${f.sizeBytes ?? 0}`)
    .sort()
    .join('\n')

  const encoded = new TextEncoder().encode(entries)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------------------
// Language aggregation
// ---------------------------------------------------------------------------

function aggregateLanguages(files: ClassifiedFile[]): DetectedLanguage[] {
  const map = new Map<string, { count: number; extensions: Set<string> }>()

  for (const file of files) {
    if (!file.language) continue
    if (file.role === 'build' || file.role === 'asset') continue

    const entry = map.get(file.language) ?? { count: 0, extensions: new Set() }
    entry.count++
    if (file.extension) entry.extensions.add(file.extension)
    map.set(file.language, entry)
  }

  return Array.from(map.entries())
    .map(([name, { count, extensions }]) => ({ name, fileCount: count, extensions: Array.from(extensions) }))
    .sort((a, b) => b.fileCount - a.fileCount)
}

// ---------------------------------------------------------------------------
// RepositoryParser class
// ---------------------------------------------------------------------------

export interface RepositoryParserOptions {
  /** Override the default token budget for content selection. */
  tokenBudget?: number
}

export class RepositoryParser {
  private readonly tokenBudget: number

  constructor(options: RepositoryParserOptions = {}) {
    this.tokenBudget = options.tokenBudget ?? DEFAULT_TOKEN_BUDGET
  }

  /**
   * Parse a RepositoryInput into a structured ParsedRepository.
   *
   * Handles two input kinds:
   *   - 'zip':  Extracts the ZIP archive and classifies files.
   *   - 'demo': Uses the pre-classified files injected into RepositoryInput.
   */
  async parse(input: RepositoryInput): Promise<ParsedRepository> {
    const warnings: string[] = []

    // ------------------------------------------------------------------
    // 1. File discovery
    // ------------------------------------------------------------------
    const rawFiles = await this.discoverFiles(input, warnings)

    // ------------------------------------------------------------------
    // 2. File classification
    // ------------------------------------------------------------------
    const classifiedFiles: ClassifiedFile[] = rawFiles.flatMap((raw) => {
      if (shouldIgnorePath(raw.path)) return []

      const cls = classifyFile(raw.path)
      const ext = raw.path.split('.').pop()?.toLowerCase()

      const file: ClassifiedFile = {
        id: `file-${raw.path.replace(/[^a-z0-9]/gi, '-')}`,
        path: raw.path,
        name: raw.name,
        extension: ext,
        language: cls.language,
        sizeBytes: raw.sizeBytes,
        role: cls.role,
        isEntryPoint: cls.isEntryPoint,
        isTest: cls.isTest,
        isDocumentation: cls.isDocumentation,
        content: raw.content,
        estimatedTokens: raw.content ? estimateTokens(raw.content) : undefined,
      }
      return [file]
    })

    // ------------------------------------------------------------------
    // 3. Metadata extraction
    // ------------------------------------------------------------------
    const manifests = classifiedFiles
      .filter((f) => f.content != null && f.role === 'configuration')
      .flatMap((f) => {
        const manifest = extractManifest(f.path, f.content!)
        return manifest ? [manifest] : []
      })

    // Resolve project name: manifest > input name
    const primaryManifest = manifests.find((m) => m.projectName)
    const name = primaryManifest?.projectName ?? input.name

    // Framework detection across all manifests
    const allDepNames = manifests.flatMap((m) => m.dependencies.map((d) => d.name))
    const frameworks = detectFrameworks(allDepNames)
    if (frameworks.length > 0) {
      // Attach detected frameworks as a warning-free metadata note
    }

    // ------------------------------------------------------------------
    // 4. Language aggregation
    // ------------------------------------------------------------------
    const detectedLanguages = aggregateLanguages(classifiedFiles)

    // ------------------------------------------------------------------
    // 5. Content selection (token budget)
    // ------------------------------------------------------------------
    const importantFiles = selectImportantFiles(classifiedFiles, this.tokenBudget)

    // ------------------------------------------------------------------
    // 6. Directory tree
    // ------------------------------------------------------------------
    const directoryTree = buildDirectoryTree(classifiedFiles)

    // ------------------------------------------------------------------
    // 7. Fingerprint
    // ------------------------------------------------------------------
    const fingerprint = await computeFingerprint(classifiedFiles)

    const estimatedTokenCount = importantFiles.reduce((sum, f) => sum + (f.estimatedTokens ?? 0), 0)

    return {
      fingerprint,
      name,
      files: classifiedFiles,
      directoryTree,
      detectedLanguages,
      manifests,
      importantFiles,
      estimatedTokenCount,
      warnings,
    }
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private async discoverFiles(
    input: RepositoryInput,
    warnings: string[],
  ): Promise<Array<{ path: string; name: string; sizeBytes: number; content?: string }>> {
    if (input.kind === 'zip' && input.archive) {
      try {
        const rawFiles = await extractZip(input.archive)
        return stripCommonPrefix(rawFiles)
      } catch (e) {
        warnings.push(`ZIP extraction failed: ${e instanceof Error ? e.message : String(e)}`)
        return []
      }
    }

    if (input.files && input.files.length > 0) {
      // Pre-classified files from demo or other sources.
      // Preserve inline content when provided so the AI prompt receives real file text.
      return input.files.map((f) => ({
        path: f.path,
        name: f.name,
        sizeBytes: f.sizeBytes ?? (f.content ? f.content.length : 0),
        content: f.content,
      }))
    }

    warnings.push('No files found in repository input.')
    return []
  }
}

// ---------------------------------------------------------------------------
// Convenience factory
// ---------------------------------------------------------------------------

/** Create a default RepositoryParser instance. */
export function createRepositoryParser(options?: RepositoryParserOptions): RepositoryParser {
  return new RepositoryParser(options)
}
