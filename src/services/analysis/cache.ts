/**
 * AnalysisCache — stores and retrieves completed RepositoryAnalysis objects
 * keyed by repository fingerprint.
 *
 * Implementations:
 *   - MemoryAnalysisCache       In-process Map; clears on page reload.
 *   - LocalStorageAnalysisCache Browser localStorage; survives page reloads.
 *
 * Both implement the same AnalysisCache interface so they can be composed
 * (memory in front, localStorage behind) or swapped without touching callers.
 */

import type { RepositoryAnalysis } from '../../types'

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface AnalysisCache {
  get(fingerprint: string): Promise<RepositoryAnalysis | null>
  set(fingerprint: string, analysis: RepositoryAnalysis): Promise<void>
  invalidate(fingerprint: string): Promise<void>
}

// ---------------------------------------------------------------------------
// MemoryAnalysisCache
// ---------------------------------------------------------------------------

export class MemoryAnalysisCache implements AnalysisCache {
  private readonly store = new Map<string, RepositoryAnalysis>()

  async get(fingerprint: string): Promise<RepositoryAnalysis | null> {
    return this.store.get(fingerprint) ?? null
  }

  async set(fingerprint: string, analysis: RepositoryAnalysis): Promise<void> {
    this.store.set(fingerprint, analysis)
  }

  async invalidate(fingerprint: string): Promise<void> {
    this.store.delete(fingerprint)
  }
}

// ---------------------------------------------------------------------------
// LocalStorageAnalysisCache
// ---------------------------------------------------------------------------

/** Prefix applied to all localStorage keys owned by this cache. */
const LS_PREFIX = 'oq:analysis:'

/** Schema version embedded in each stored entry. Increment when the
 *  RepositoryAnalysis shape changes incompatibly. */
const SCHEMA_VERSION = 1

interface StoredEntry {
  schemaVersion: number
  fingerprint: string
  analysis: RepositoryAnalysis
  storedAt: string
}

export class LocalStorageAnalysisCache implements AnalysisCache {
  async get(fingerprint: string): Promise<RepositoryAnalysis | null> {
    try {
      const raw = localStorage.getItem(LS_PREFIX + fingerprint)
      if (!raw) return null

      const entry = JSON.parse(raw) as StoredEntry

      // Reject stale entries from an older schema version
      if (entry.schemaVersion !== SCHEMA_VERSION) {
        localStorage.removeItem(LS_PREFIX + fingerprint)
        return null
      }

      return entry.analysis
    } catch {
      return null
    }
  }

  async set(fingerprint: string, analysis: RepositoryAnalysis): Promise<void> {
    const entry: StoredEntry = {
      schemaVersion: SCHEMA_VERSION,
      fingerprint,
      analysis,
      storedAt: new Date().toISOString(),
    }
    try {
      localStorage.setItem(LS_PREFIX + fingerprint, JSON.stringify(entry))
    } catch (e) {
      // localStorage quota exceeded — evict the oldest entry and retry once
      this.evictOldest()
      try {
        localStorage.setItem(LS_PREFIX + fingerprint, JSON.stringify(entry))
      } catch {
        // If still failing (e.g. single entry is too large), silently skip caching
        console.warn('[AnalysisCache] Failed to cache analysis — localStorage full.', e)
      }
    }
  }

  async invalidate(fingerprint: string): Promise<void> {
    localStorage.removeItem(LS_PREFIX + fingerprint)
  }

  /** Remove the oldest cached entry to make room. */
  private evictOldest(): void {
    const keysWithDates: Array<{ key: string; storedAt: string }> = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(LS_PREFIX)) continue

      try {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const entry = JSON.parse(raw) as Partial<StoredEntry>
        keysWithDates.push({ key, storedAt: entry.storedAt ?? '1970-01-01' })
      } catch {
        // Corrupted entry — remove it
        localStorage.removeItem(key)
        return
      }
    }

    if (keysWithDates.length === 0) return

    keysWithDates.sort((a, b) => a.storedAt.localeCompare(b.storedAt))
    localStorage.removeItem(keysWithDates[0].key)
  }
}

// ---------------------------------------------------------------------------
// TieredAnalysisCache — memory in front of localStorage
// ---------------------------------------------------------------------------

/**
 * Two-tier cache: checks memory first (fast), falls through to localStorage
 * (persistent). Writes are reflected in both tiers.
 */
export class TieredAnalysisCache implements AnalysisCache {
  private readonly memory = new MemoryAnalysisCache()
  private readonly persistent: AnalysisCache

  constructor(persistent: AnalysisCache = new LocalStorageAnalysisCache()) {
    this.persistent = persistent
  }

  async get(fingerprint: string): Promise<RepositoryAnalysis | null> {
    const memHit = await this.memory.get(fingerprint)
    if (memHit) return memHit

    const persisted = await this.persistent.get(fingerprint)
    if (persisted) {
      // Warm the memory tier
      await this.memory.set(fingerprint, persisted)
    }
    return persisted
  }

  async set(fingerprint: string, analysis: RepositoryAnalysis): Promise<void> {
    await Promise.all([
      this.memory.set(fingerprint, analysis),
      this.persistent.set(fingerprint, analysis),
    ])
  }

  async invalidate(fingerprint: string): Promise<void> {
    await Promise.all([
      this.memory.invalidate(fingerprint),
      this.persistent.invalidate(fingerprint),
    ])
  }
}
