import type { RepositoryAnalysis, RepositoryAnalysisRequest } from '../../types'
import type { AIProvider } from '../ai/provider'
import { TieredAnalysisCache } from './cache'
import { AIAnalysisService } from './aiAnalysisService'

export interface AnalysisService {
  analyze(request: RepositoryAnalysisRequest): Promise<RepositoryAnalysis>
}

export class UnconfiguredAnalysisService implements AnalysisService {
  async analyze(_request: RepositoryAnalysisRequest): Promise<RepositoryAnalysis> {
    throw new Error('Repository analysis is not configured. Call createAnalysisService() with an AIProvider to enable it.')
  }
}

export type { AnalysisCache } from './cache'
export { MemoryAnalysisCache, LocalStorageAnalysisCache, TieredAnalysisCache } from './cache'
export { AIAnalysisService } from './aiAnalysisService'
export type { AIAnalysisServiceOptions } from './aiAnalysisService'

// ---------------------------------------------------------------------------
// createAnalysisService — convenience factory
// ---------------------------------------------------------------------------

/**
 * Create an AnalysisService backed by an AI provider.
 *
 * Usage:
 *   import { createAnalysisService } from './services/analysis'
 *   import { createAIProvider } from './services/ai/provider'
 *
 *   const service = createAnalysisService(
 *     createAIProvider({ kind: 'backend-proxy', proxyUrl: '/api/analyze' })
 *   )
 *
 * If no provider is supplied the returned service throws a descriptive error
 * when called, preserving the prototype behaviour.
 */
export function createAnalysisService(provider?: AIProvider): AnalysisService {
  if (!provider) return new UnconfiguredAnalysisService()
  return new AIAnalysisService({
    provider,
    cache: new TieredAnalysisCache(),
  })
}
