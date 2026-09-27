/**
 * File classifier — maps file extensions and path patterns to languages and roles.
 *
 * This module contains zero AI. It applies heuristic rules to assign:
 *   - programming language
 *   - role bucket (entry-point, test, documentation, configuration, …)
 *   - boolean flags (isEntryPoint, isTest, isDocumentation)
 *
 * Rules are defined as plain data structures so they are easy to extend.
 */

import type { FileRole } from './types'

// ---------------------------------------------------------------------------
// Extension → language
// ---------------------------------------------------------------------------

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  // JavaScript / TypeScript
  ts: 'TypeScript',
  tsx: 'TypeScript',
  mts: 'TypeScript',
  cts: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  // Python
  py: 'Python',
  pyi: 'Python',
  // Java / JVM
  java: 'Java',
  kt: 'Kotlin',
  kts: 'Kotlin',
  scala: 'Scala',
  groovy: 'Groovy',
  // C / C++
  c: 'C',
  h: 'C',
  cpp: 'C++',
  cxx: 'C++',
  cc: 'C++',
  hpp: 'C++',
  // C#
  cs: 'C#',
  // Go
  go: 'Go',
  // Rust
  rs: 'Rust',
  // Ruby
  rb: 'Ruby',
  // PHP
  php: 'PHP',
  // Swift / Objective-C
  swift: 'Swift',
  m: 'Objective-C',
  // Dart / Flutter
  dart: 'Dart',
  // Shell
  sh: 'Shell',
  bash: 'Shell',
  zsh: 'Shell',
  fish: 'Shell',
  ps1: 'PowerShell',
  // Web
  html: 'HTML',
  htm: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sass: 'SCSS',
  less: 'Less',
  // Data / config
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  xml: 'XML',
  // SQL
  sql: 'SQL',
  // Markdown / docs
  md: 'Markdown',
  mdx: 'Markdown',
  rst: 'reStructuredText',
  txt: 'Text',
  // GraphQL
  graphql: 'GraphQL',
  gql: 'GraphQL',
  // Protocol Buffers
  proto: 'Protobuf',
  // Terraform / HCL
  tf: 'HCL',
  hcl: 'HCL',
  // Docker
  dockerfile: 'Dockerfile',
}

// ---------------------------------------------------------------------------
// Path pattern → role
// ---------------------------------------------------------------------------

interface PathRoleRule {
  /** A substring or regex pattern tested against the normalised file path. */
  pattern: string | RegExp
  role: FileRole
  isTest?: boolean
  isDocumentation?: boolean
  isEntryPoint?: boolean
}

/**
 * Rules are evaluated in order; the first match wins.
 * Path is normalised to forward slashes and lower-cased before matching.
 */
const PATH_ROLE_RULES: PathRoleRule[] = [
  // Ignore / build artefacts — classified first so they short-circuit
  { pattern: /node_modules\//, role: 'other' },
  { pattern: /\/(dist|build|out|\.next|\.nuxt|__pycache__|\.mypy_cache|\.tox|target\/)\//,role: 'build' },
  { pattern: /\.(min\.js|bundle\.js|chunk\.js)$/, role: 'build' },

  // Tests
  { pattern: /\/(tests?|__tests?__|spec|__spec__)\//,  role: 'test', isTest: true },
  { pattern: /\.(test|spec)\.(ts|tsx|js|jsx|py|rb|go|rs|java|cs|kt|php)$/, role: 'test', isTest: true },
  { pattern: /_test\.(go|rs|py)$/, role: 'test', isTest: true },

  // Documentation
  { pattern: /readme(\.\w+)?$/i,           role: 'documentation', isDocumentation: true },
  { pattern: /changelog(\.\w+)?$/i,        role: 'documentation', isDocumentation: true },
  { pattern: /contributing(\.\w+)?$/i,     role: 'documentation', isDocumentation: true },
  { pattern: /license(\.\w+)?$/i,          role: 'documentation', isDocumentation: true },
  { pattern: /\/docs?\//,                  role: 'documentation', isDocumentation: true },
  { pattern: /\/documentation\//,          role: 'documentation', isDocumentation: true },
  { pattern: /\.md$/,                      role: 'documentation', isDocumentation: true },
  { pattern: /\.rst$/,                     role: 'documentation', isDocumentation: true },

  // Configuration files
  { pattern: /package\.json$/,             role: 'configuration' },
  { pattern: /package-lock\.json$/,        role: 'configuration' },
  { pattern: /yarn\.lock$/,                role: 'configuration' },
  { pattern: /pnpm-lock\.yaml$/,           role: 'configuration' },
  { pattern: /tsconfig(\.\w+)?\.json$/,    role: 'configuration' },
  { pattern: /jsconfig\.json$/,            role: 'configuration' },
  { pattern: /\.eslintrc(\.\w+)?$/,        role: 'configuration' },
  { pattern: /\.prettierrc(\.\w+)?$/,      role: 'configuration' },
  { pattern: /\.(babelrc|babel\.config)/,  role: 'configuration' },
  { pattern: /vite\.config\./,             role: 'configuration' },
  { pattern: /webpack\.config\./,          role: 'configuration' },
  { pattern: /rollup\.config\./,           role: 'configuration' },
  { pattern: /jest\.config\./,             role: 'configuration' },
  { pattern: /vitest\.config\./,           role: 'configuration' },
  { pattern: /\.env(\.\w+)?$/,             role: 'configuration' },
  { pattern: /requirements\.txt$/,         role: 'configuration' },
  { pattern: /setup\.(py|cfg)$/,           role: 'configuration' },
  { pattern: /pyproject\.toml$/,           role: 'configuration' },
  { pattern: /cargo\.toml$/i,              role: 'configuration' },
  { pattern: /go\.(mod|sum)$/,             role: 'configuration' },
  { pattern: /gemfile(\.lock)?$/i,         role: 'configuration' },
  { pattern: /composer\.(json|lock)$/i,    role: 'configuration' },
  { pattern: /pom\.xml$/i,                 role: 'configuration' },
  { pattern: /build\.gradle(\.kts)?$/,     role: 'configuration' },
  { pattern: /makefile$/i,                 role: 'configuration' },
  { pattern: /dockerfile$/i,               role: 'configuration' },
  { pattern: /docker-compose(\.\w+)?\.ya?ml$/, role: 'configuration' },
  { pattern: /\.github\//,                 role: 'configuration' },
  { pattern: /\.gitlab-ci\.ya?ml$/,        role: 'configuration' },
  { pattern: /\.circleci\//,               role: 'configuration' },

  // Schemas
  { pattern: /\.sql$/,                     role: 'schema' },
  { pattern: /\.graphql$|\.gql$/,          role: 'schema' },
  { pattern: /\.proto$/,                   role: 'schema' },
  { pattern: /\/migrations?\//,            role: 'schema' },
  { pattern: /\/schema\//,                 role: 'schema' },

  // Styles
  { pattern: /\.(css|scss|sass|less|styl)$/, role: 'style' },

  // Assets
  { pattern: /\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|mp4|mp3|wav)$/, role: 'asset' },

  // Entry points — common by convention
  { pattern: /\/(main|index|app|server|index\.server)\.(ts|tsx|js|jsx|mts|mjs)$/, role: 'entry-point', isEntryPoint: true },
  { pattern: /\/(app|application|server|main)\.(py|rb|go|rs|java|cs|php|swift)$/, role: 'entry-point', isEntryPoint: true },
  { pattern: /\/cmd\/[^/]+\/main\.go$/, role: 'entry-point', isEntryPoint: true },
]

// ---------------------------------------------------------------------------
// Filename → role (no-extension fallback)
// ---------------------------------------------------------------------------

const FILENAME_ROLE_MAP: Record<string, Partial<PathRoleRule>> = {
  dockerfile: { role: 'configuration' },
  makefile: { role: 'configuration' },
  rakefile: { role: 'configuration' },
  gemfile: { role: 'configuration' },
  procfile: { role: 'configuration' },
  '.gitignore': { role: 'configuration' },
  '.gitattributes': { role: 'configuration' },
  '.editorconfig': { role: 'configuration' },
  '.nvmrc': { role: 'configuration' },
  readme: { role: 'documentation', isDocumentation: true },
  license: { role: 'documentation', isDocumentation: true },
  changelog: { role: 'documentation', isDocumentation: true },
  contributing: { role: 'documentation', isDocumentation: true },
}

// ---------------------------------------------------------------------------
// Paths to ignore entirely
// ---------------------------------------------------------------------------

const IGNORED_PATH_PATTERNS: RegExp[] = [
  /node_modules\//,
  /\/(dist|build|out|\.next|\.nuxt|__pycache__|\.mypy_cache|\.ruff_cache|\.tox|target\/release|target\/debug)\//,
  /\.git\//,
  /\.(png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|mp4|mp3|wav|bin|exe|dll|so|dylib|zip|tar|gz|rar|7z)$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /composer\.lock$/,
  /poetry\.lock$/,
  /cargo\.lock$/i,
]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns true if the path should be excluded from parsing entirely. */
export function shouldIgnorePath(normalizedPath: string): boolean {
  return IGNORED_PATH_PATTERNS.some((pattern) => pattern.test(normalizedPath))
}

export interface ClassificationResult {
  language?: string
  role: FileRole
  isEntryPoint: boolean
  isTest: boolean
  isDocumentation: boolean
}

/**
 * Classify a single file by its normalised path (forward slashes, not
 * lower-cased for pattern tests that require the original case, but
 * we lower-case for consistent matching in most rules).
 */
export function classifyFile(normalizedPath: string): ClassificationResult {
  const lower = normalizedPath.toLowerCase()
  const ext = lower.split('.').pop() ?? ''
  const filename = lower.split('/').pop() ?? ''
  const filenameNoExt = filename.includes('.') ? filename.split('.').slice(0, -1).join('.') : filename

  // Language from extension
  const language = EXTENSION_LANGUAGE_MAP[ext]

  // Filename-based role (no extension or known special filenames)
  const filenameLookup = FILENAME_ROLE_MAP[filename] ?? FILENAME_ROLE_MAP[filenameNoExt]

  // Path-pattern rules (first match wins)
  for (const rule of PATH_ROLE_RULES) {
    const matched =
      typeof rule.pattern === 'string'
        ? lower.includes(rule.pattern)
        : rule.pattern.test(lower)

    if (matched) {
      return {
        language,
        role: rule.role,
        isEntryPoint: rule.isEntryPoint ?? false,
        isTest: rule.isTest ?? false,
        isDocumentation: rule.isDocumentation ?? false,
      }
    }
  }

  // Filename fallback
  if (filenameLookup) {
    return {
      language,
      role: filenameLookup.role ?? 'other',
      isEntryPoint: filenameLookup.isEntryPoint ?? false,
      isTest: filenameLookup.isTest ?? false,
      isDocumentation: filenameLookup.isDocumentation ?? false,
    }
  }

  return {
    language,
    role: language ? 'source' : 'other',
    isEntryPoint: false,
    isTest: false,
    isDocumentation: false,
  }
}
