/**
 * Metadata extractor — parses recognised manifest and config files.
 *
 * Supported manifests:
 *   - package.json  (npm / Node)
 *   - requirements.txt (Python pip)
 *   - pyproject.toml (Python PEP 517)
 *   - Cargo.toml (Rust)
 *   - go.mod (Go)
 *   - pom.xml (Java Maven — name/version only)
 *   - build.gradle / build.gradle.kts (Gradle — name only)
 *   - Gemfile / Gemfile.lock (Ruby — gem names only)
 *
 * Each extractor returns a ManifestData or null if the file is not
 * recognised or its content cannot be parsed.
 *
 * This module contains zero AI. All extraction is text/regex based.
 */

import type { ExtractedDependency, ManifestData } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safe JSON parse that returns null on failure. */
function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined
}

// ---------------------------------------------------------------------------
// package.json
// ---------------------------------------------------------------------------

function extractPackageJson(filePath: string, content: string): ManifestData | null {
  const pkg = tryParseJson(content)
  if (!pkg) return null

  const deps = asRecord(pkg.dependencies) ?? {}
  const devDeps = asRecord(pkg.devDependencies) ?? {}
  const peerDeps = asRecord(pkg.peerDependencies) ?? {}

  const toDep = (name: string, version: unknown, isDev: boolean): ExtractedDependency => ({
    name,
    version: typeof version === 'string' ? version : undefined,
    isDevelopmentOnly: isDev,
    ecosystem: 'npm',
  })

  const dependencies: ExtractedDependency[] = [
    ...Object.entries(deps).map(([n, v]) => toDep(n, v, false)),
    ...Object.entries(devDeps).map(([n, v]) => toDep(n, v, true)),
    ...Object.entries(peerDeps).map(([n, v]) => toDep(n, v, false)),
  ]

  const scripts: Record<string, string> = {}
  const rawScripts = asRecord(pkg.scripts) ?? {}
  for (const [k, v] of Object.entries(rawScripts)) {
    if (typeof v === 'string') scripts[k] = v
  }

  return {
    filePath,
    projectName: asString(pkg.name),
    version: asString(pkg.version),
    description: asString(pkg.description),
    ecosystem: 'npm',
    dependencies,
    scripts: Object.keys(scripts).length > 0 ? scripts : undefined,
    entryPointHint: asString(pkg.main) ?? asString(pkg.module),
  }
}

// ---------------------------------------------------------------------------
// requirements.txt
// ---------------------------------------------------------------------------

function extractRequirementsTxt(filePath: string, content: string): ManifestData {
  const dependencies: ExtractedDependency[] = []

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith('-r ') || line.startsWith('--')) continue

    // Handle common specifiers: ==, >=, <=, ~=, !=, >
    const match = line.match(/^([A-Za-z0-9_\-.[\]]+)\s*([=!<>~].+)?/)
    if (match) {
      dependencies.push({
        name: match[1],
        version: match[2]?.trim(),
        isDevelopmentOnly: false,
        ecosystem: 'pip',
      })
    }
  }

  return { filePath, ecosystem: 'pip', dependencies }
}

// ---------------------------------------------------------------------------
// pyproject.toml — minimal TOML-lite extraction (no full TOML parser)
// ---------------------------------------------------------------------------

/** Extract a quoted string value for a key from a TOML fragment. */
function tomlString(text: string, key: string): string | undefined {
  const m = text.match(new RegExp(`${key}\\s*=\\s*["']([^"']+)["']`))
  return m ? m[1] : undefined
}

function extractPyprojectToml(filePath: string, content: string): ManifestData {
  const dependencies: ExtractedDependency[] = []

  // [tool.poetry.dependencies] or [project] dependencies array
  const depsSection = content.match(/\[(?:tool\.poetry\.)?dependencies\]([\s\S]*?)(?=\n\[|$)/)
  if (depsSection) {
    for (const line of depsSection[1].split('\n')) {
      const m = line.match(/^([A-Za-z0-9_\-.]+)\s*=\s*["^~>=<!]?["^~>=<!]?(.*)/)
      if (m && m[1] !== 'python') {
        dependencies.push({ name: m[1], version: m[2].replace(/['"]/g, '').trim() || undefined, isDevelopmentOnly: false, ecosystem: 'pip' })
      }
    }
  }

  return {
    filePath,
    projectName: tomlString(content, 'name'),
    version: tomlString(content, 'version'),
    description: tomlString(content, 'description'),
    ecosystem: 'pip',
    dependencies,
  }
}

// ---------------------------------------------------------------------------
// Cargo.toml
// ---------------------------------------------------------------------------

function extractCargoToml(filePath: string, content: string): ManifestData {
  const dependencies: ExtractedDependency[] = []

  const depsSection = content.match(/\[dependencies\]([\s\S]*?)(?=\n\[|$)/)
  if (depsSection) {
    for (const line of depsSection[1].split('\n')) {
      const m = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*["^~>=<!]?(.*)/)
      if (m) {
        dependencies.push({ name: m[1], version: m[2].replace(/['"{}version=\s]/g, '').trim() || undefined, isDevelopmentOnly: false, ecosystem: 'cargo' })
      }
    }
  }

  const devDepsSection = content.match(/\[dev-dependencies\]([\s\S]*?)(?=\n\[|$)/)
  if (devDepsSection) {
    for (const line of devDepsSection[1].split('\n')) {
      const m = line.match(/^([a-zA-Z0-9_-]+)\s*=/)
      if (m) {
        dependencies.push({ name: m[1], isDevelopmentOnly: true, ecosystem: 'cargo' })
      }
    }
  }

  return {
    filePath,
    projectName: tomlString(content, 'name'),
    version: tomlString(content, 'version'),
    description: tomlString(content, 'description'),
    ecosystem: 'cargo',
    dependencies,
  }
}

// ---------------------------------------------------------------------------
// go.mod
// ---------------------------------------------------------------------------

function extractGoMod(filePath: string, content: string): ManifestData {
  const dependencies: ExtractedDependency[] = []
  let projectName: string | undefined

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('module ')) {
      projectName = trimmed.slice(7).trim()
    } else if (trimmed.startsWith('require ') || /^\t/.test(trimmed)) {
      const m = trimmed.replace(/^\t/, '').match(/^([^\s]+)\s+v?([^\s]+)/)
      if (m && m[1] !== '(' && m[1] !== ')') {
        dependencies.push({ name: m[1], version: m[2], isDevelopmentOnly: false, ecosystem: 'go' })
      }
    }
  }

  return { filePath, projectName, ecosystem: 'go', dependencies }
}

// ---------------------------------------------------------------------------
// Gemfile (Ruby) — capture gem names only
// ---------------------------------------------------------------------------

function extractGemfile(filePath: string, content: string): ManifestData {
  const dependencies: ExtractedDependency[] = []

  for (const line of content.split('\n')) {
    const m = line.trim().match(/^gem\s+['"]([^'"]+)['"](?:,\s*['"]([^'"]+)['"])?/)
    if (m) {
      dependencies.push({ name: m[1], version: m[2], isDevelopmentOnly: false, ecosystem: 'rubygems' })
    }
  }

  return { filePath, ecosystem: 'rubygems', dependencies }
}

// ---------------------------------------------------------------------------
// pom.xml (Maven) — name and version only
// ---------------------------------------------------------------------------

function extractPomXml(filePath: string, content: string): ManifestData {
  const nameMatch    = content.match(/<artifactId>([^<]+)<\/artifactId>/)
  const versionMatch = content.match(/<version>([^<]+)<\/version>/)

  return {
    filePath,
    projectName: nameMatch ? nameMatch[1] : undefined,
    version: versionMatch ? versionMatch[1] : undefined,
    ecosystem: 'maven',
    dependencies: [], // full dep extraction from POM XML is complex; skip
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Attempt to extract manifest metadata from a file.
 *
 * @param filePath  Normalised path within the repository.
 * @param content   Raw UTF-8 text content.
 * @returns         Parsed ManifestData, or null if not a recognised manifest.
 */
export function extractManifest(filePath: string, content: string): ManifestData | null {
  const lower = filePath.toLowerCase()
  const name  = lower.split('/').pop() ?? ''

  if (name === 'package.json')       return extractPackageJson(filePath, content)
  if (name === 'requirements.txt')   return extractRequirementsTxt(filePath, content)
  if (name === 'pyproject.toml')     return extractPyprojectToml(filePath, content)
  if (name === 'cargo.toml')         return extractCargoToml(filePath, content)
  if (name === 'go.mod')             return extractGoMod(filePath, content)
  if (name === 'gemfile')            return extractGemfile(filePath, content)
  if (name === 'pom.xml')            return extractPomXml(filePath, content)

  return null
}

// ---------------------------------------------------------------------------
// Framework detection from dependency names
// ---------------------------------------------------------------------------

interface FrameworkSignature {
  packages: string[]
  name: string
  category: 'frontend' | 'backend' | 'testing' | 'database' | 'tooling' | 'mobile' | 'other'
}

const FRAMEWORK_SIGNATURES: FrameworkSignature[] = [
  // Frontend
  { packages: ['react', 'react-dom'],         name: 'React',      category: 'frontend' },
  { packages: ['vue'],                         name: 'Vue',        category: 'frontend' },
  { packages: ['@angular/core'],               name: 'Angular',    category: 'frontend' },
  { packages: ['svelte'],                      name: 'Svelte',     category: 'frontend' },
  { packages: ['solid-js'],                    name: 'SolidJS',    category: 'frontend' },
  { packages: ['next'],                        name: 'Next.js',    category: 'frontend' },
  { packages: ['nuxt'],                        name: 'Nuxt',       category: 'frontend' },
  { packages: ['gatsby'],                      name: 'Gatsby',     category: 'frontend' },
  { packages: ['astro'],                       name: 'Astro',      category: 'frontend' },
  // Backend JS
  { packages: ['express'],                     name: 'Express',    category: 'backend' },
  { packages: ['fastify'],                     name: 'Fastify',    category: 'backend' },
  { packages: ['hono'],                        name: 'Hono',       category: 'backend' },
  { packages: ['koa'],                         name: 'Koa',        category: 'backend' },
  { packages: ['@nestjs/core'],                name: 'NestJS',     category: 'backend' },
  // Testing
  { packages: ['jest'],                        name: 'Jest',       category: 'testing' },
  { packages: ['vitest'],                      name: 'Vitest',     category: 'testing' },
  { packages: ['mocha'],                       name: 'Mocha',      category: 'testing' },
  { packages: ['jasmine'],                     name: 'Jasmine',    category: 'testing' },
  { packages: ['@playwright/test'],            name: 'Playwright', category: 'testing' },
  { packages: ['cypress'],                     name: 'Cypress',    category: 'testing' },
  // Databases
  { packages: ['pg', 'postgres'],              name: 'PostgreSQL', category: 'database' },
  { packages: ['mysql2', 'mysql'],             name: 'MySQL',      category: 'database' },
  { packages: ['better-sqlite3', 'sqlite3'],   name: 'SQLite',     category: 'database' },
  { packages: ['mongoose', 'mongodb'],         name: 'MongoDB',    category: 'database' },
  { packages: ['prisma', '@prisma/client'],    name: 'Prisma',     category: 'database' },
  { packages: ['typeorm'],                     name: 'TypeORM',    category: 'database' },
  { packages: ['drizzle-orm'],                 name: 'Drizzle',    category: 'database' },
  { packages: ['redis', 'ioredis'],            name: 'Redis',      category: 'database' },
  // Tooling
  { packages: ['vite'],                        name: 'Vite',       category: 'tooling' },
  { packages: ['webpack'],                     name: 'Webpack',    category: 'tooling' },
  { packages: ['rollup'],                      name: 'Rollup',     category: 'tooling' },
  { packages: ['esbuild'],                     name: 'esbuild',    category: 'tooling' },
  { packages: ['tailwindcss'],                 name: 'Tailwind CSS', category: 'tooling' },
  // Python
  { packages: ['django'],                      name: 'Django',     category: 'backend' },
  { packages: ['flask'],                       name: 'Flask',      category: 'backend' },
  { packages: ['fastapi'],                     name: 'FastAPI',    category: 'backend' },
  { packages: ['sqlalchemy'],                  name: 'SQLAlchemy', category: 'database' },
  { packages: ['pytest'],                      name: 'pytest',     category: 'testing' },
  // Java/Kotlin
  { packages: ['spring-boot', 'spring-core'], name: 'Spring Boot', category: 'backend' },
  // Rust
  { packages: ['actix-web'],                   name: 'Actix Web',  category: 'backend' },
  { packages: ['axum'],                        name: 'Axum',       category: 'backend' },
  { packages: ['tokio'],                       name: 'Tokio',      category: 'backend' },
  // Go
  { packages: ['github.com/gin-gonic/gin'],    name: 'Gin',        category: 'backend' },
  { packages: ['github.com/gofiber/fiber'],    name: 'Fiber',      category: 'backend' },
]

/** Detect frameworks from a list of dependency names across all manifests. */
export function detectFrameworks(allDependencyNames: string[]): string[] {
  const nameSet = new Set(allDependencyNames.map((n) => n.toLowerCase()))
  const found: string[] = []

  for (const sig of FRAMEWORK_SIGNATURES) {
    if (sig.packages.some((pkg) => nameSet.has(pkg.toLowerCase()))) {
      found.push(sig.name)
    }
  }

  return found
}
