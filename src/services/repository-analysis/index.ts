/**
 * Repository Analysis Service — public API
 *
 * The repository parsing boundary (ARCHITECTURE.md §8.2).
 * Transforms raw RepositoryInput into a structured ParsedRepository
 * without making any AI or LLM calls.
 *
 * Usage:
 *   import { createRepositoryParser } from './services/repository-analysis'
 *   const parser = createRepositoryParser()
 *   const parsed = await parser.parse(input)
 */

export { RepositoryParser, createRepositoryParser } from './parser'
export type { RepositoryParserOptions } from './parser'
export type {
  ParsedRepository,
  ClassifiedFile,
  DetectedLanguage,
  ExtractedDependency,
  ManifestData,
  DirectoryNode,
  FileRole,
} from './types'
