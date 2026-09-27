/**
 * Types for the repository parsing pipeline.
 *
 * This layer is purely mechanical — no AI, no LLM calls.
 * It transforms raw RepositoryInput files into a structured RepositoryContext
 * that the AI analysis layer can consume.
 */

import type { RepositoryFile } from '../../types'

// ---------------------------------------------------------------------------
// File classification
// ---------------------------------------------------------------------------

/** Broad role bucket assigned to a file based on path/extension heuristics. */
export type FileRole =
  | 'entry-point'
  | 'source'
  | 'test'
  | 'documentation'
  | 'configuration'
  | 'schema'
  | 'style'
  | 'asset'
  | 'build'
  | 'other'

/** A classified file; extends RepositoryFile with parsing-layer fields. */
export interface ClassifiedFile extends RepositoryFile {
  /** Raw text content — only populated for text files within the token budget. */
  content?: string
  /** Estimated GPT-3/4 token count for the content. */
  estimatedTokens?: number
}

// ---------------------------------------------------------------------------
// Extracted metadata
// ---------------------------------------------------------------------------

/** Language detected in the repository plus the number of files using it. */
export interface DetectedLanguage {
  name: string
  fileCount: number
  /** File extensions that contributed to this detection. */
  extensions: string[]
}

/** A dependency extracted from a manifest file (package.json, requirements.txt, etc.). */
export interface ExtractedDependency {
  name: string
  version?: string
  isDevelopmentOnly: boolean
  ecosystem: string
}

/** Data extracted from a recognised manifest file. */
export interface ManifestData {
  /** Path of the manifest file within the repository. */
  filePath: string
  /** Project/package name declared in the manifest. */
  projectName?: string
  /** Version declared in the manifest. */
  version?: string
  /** Plain-text description. */
  description?: string
  /** Detected ecosystem (npm, pip, cargo, …). */
  ecosystem: string
  /** Production and development dependencies combined. */
  dependencies: ExtractedDependency[]
  /** Scripts / tasks declared (e.g. npm scripts). */
  scripts?: Record<string, string>
  /** Raw entry point hint from the manifest (e.g. "main" in package.json). */
  entryPointHint?: string
}

// ---------------------------------------------------------------------------
// Directory structure
// ---------------------------------------------------------------------------

/** A single node in the directory tree. */
export interface DirectoryNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: DirectoryNode[]
  /** File role, present when type === 'file'. */
  role?: FileRole
  language?: string
}

// ---------------------------------------------------------------------------
// Parsed repository — the output of the parsing pipeline
// ---------------------------------------------------------------------------

/**
 * The result of running the parsing pipeline on a RepositoryInput.
 * This is passed to the AI analysis layer as RepositoryContext.
 */
export interface ParsedRepository {
  /** Stable SHA-256 fingerprint of the repository content (path + size pairs). */
  fingerprint: string

  /** Repository / project name (from manifest or directory name). */
  name: string

  /** All classified files (excluding ignored paths). */
  files: ClassifiedFile[]

  /** Logical directory tree (top 3 levels, pruned for readability). */
  directoryTree: DirectoryNode[]

  /** Languages detected, ordered by file count descending. */
  detectedLanguages: DetectedLanguage[]

  /** Parsed manifests (package.json, requirements.txt, Cargo.toml, …). */
  manifests: ManifestData[]

  /** Files selected for content inclusion (respects token budget). */
  importantFiles: ClassifiedFile[]

  /** Total estimated token count across importantFiles. */
  estimatedTokenCount: number

  /** Warnings emitted during parsing (e.g. unrecognised archive format). */
  warnings: string[]
}
