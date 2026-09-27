/**
 * Content selector — chooses which files to include verbatim in the
 * AI analysis prompt, respecting a token budget.
 *
 * Strategy (in priority order):
 *   1. Entry points
 *   2. Documentation files (README, CHANGELOG, …)
 *   3. Configuration / manifest files (package.json, …)
 *   4. Schema files (SQL, GraphQL, …)
 *   5. Source files ordered by relevance heuristic (shorter first, then alphabetical)
 *   6. Test files (lower priority — structure matters more than content here)
 *
 * Files already exceeding MAX_SINGLE_FILE_TOKENS are included but truncated
 * with a clear marker so the LLM knows the file was cut.
 *
 * Token estimation: 1 token ≈ 4 characters (rough GPT approximation).
 */

import type { ClassifiedFile, DirectoryNode } from './types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default total token budget for all file contents sent to the LLM. */
export const DEFAULT_TOKEN_BUDGET = 60_000

/** Maximum tokens contributed by a single file. */
const MAX_SINGLE_FILE_TOKENS = 4_000

/** Rough characters-per-token ratio for estimation. */
const CHARS_PER_TOKEN = 4

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

function truncateContent(content: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN
  if (content.length <= maxChars) return content
  return content.slice(0, maxChars) + '\n\n[... file truncated — content exceeds token limit ...]'
}

// ---------------------------------------------------------------------------
// Priority scoring
// ---------------------------------------------------------------------------

/**
 * Lower score = higher priority.
 */
function priorityScore(file: ClassifiedFile): number {
  if (file.isEntryPoint)    return 0
  if (file.isDocumentation) return 1

  switch (file.role) {
    case 'configuration': return 2
    case 'schema':        return 3
    case 'entry-point':   return 4
    case 'source':        return 5
    case 'test':          return 7
    case 'style':         return 8
    default:              return 9
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Select the most relevant files for AI analysis, respecting a token budget.
 *
 * @param files        All classified files with optional content.
 * @param tokenBudget  Maximum total tokens to allocate (default: DEFAULT_TOKEN_BUDGET).
 * @returns            Subset of files with content set/truncated, plus per-file token counts.
 */
export function selectImportantFiles(
  files: ClassifiedFile[],
  tokenBudget: number = DEFAULT_TOKEN_BUDGET,
): ClassifiedFile[] {
  // Only consider files that have decoded content
  const candidates = files.filter((f) => f.content != null && f.role !== 'asset' && f.role !== 'build')

  // Sort: priority first, then by content length (shorter = more likely to be fully included)
  candidates.sort((a, b) => {
    const pd = priorityScore(a) - priorityScore(b)
    if (pd !== 0) return pd
    return (a.content?.length ?? 0) - (b.content?.length ?? 0)
  })

  const selected: ClassifiedFile[] = []
  let budgetUsed = 0

  for (const file of candidates) {
    if (budgetUsed >= tokenBudget) break

    const remaining = tokenBudget - budgetUsed
    const rawTokens = estimateTokens(file.content ?? '')
    const allocated  = Math.min(rawTokens, MAX_SINGLE_FILE_TOKENS, remaining)

    if (allocated <= 0) break

    selected.push({
      ...file,
      content: truncateContent(file.content ?? '', allocated),
      estimatedTokens: allocated,
    })

    budgetUsed += allocated
  }

  return selected
}

/**
 * Build the directory tree representation (up to maxDepth levels deep).
 * Prunes build/asset/ignored subtrees for readability.
 */
export function buildDirectoryTree(
  files: ClassifiedFile[],
  maxDepth = 3,
): DirectoryNode[] {
  const root: DirectoryNode = { name: '/', path: '', type: 'directory', children: [] }

  for (const file of files) {
    if (file.role === 'build' || file.role === 'asset') continue

    const parts = file.path.split('/')
    if (parts.length > maxDepth + 1) {
      // Only include files within maxDepth; skip deeper nesting
      continue
    }

    let current = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1

      if (isLast) {
        current.children ??= []
        current.children.push({
          name: file.name,
          path: file.path,
          type: 'file',
          role: file.role as DirectoryNode['role'],
          language: file.language,
        })
      } else {
        current.children ??= []
        let dir = current.children.find((c) => c.name === part && c.type === 'directory')
        if (!dir) {
          dir = {
            name: part,
            path: parts.slice(0, i + 1).join('/'),
            type: 'directory',
            children: [],
          }
          current.children.push(dir)
        }
        current = dir
      }
    }
  }

  return root.children ?? []
}
