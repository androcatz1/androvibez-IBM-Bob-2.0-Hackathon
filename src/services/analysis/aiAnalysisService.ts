/**
 * AI-powered AnalysisService implementation.
 *
 * This is the concrete implementation of the AnalysisService interface that
 * wires together:
 *   1. RepositoryParser → ParsedRepository (structured context, no AI)
 *   2. AnalysisCache    → cache lookup by fingerprint
 *   3. AIProvider       → LLM call (only on cache miss)
 *   4. prompt builder   → converts ParsedRepository to LLM messages
 *   5. response parser  → validates LLM JSON → RepositoryAnalysis
 *
 * The cache is checked BEFORE the LLM is called so that the same repository
 * is only analysed once per unique fingerprint (ARCHITECTURE.md §5).
 */

import type { RepositoryAnalysis, RepositoryAnalysisRequest } from '../../types'
import type { AnalysisService } from './index'
import type { AnalysisCache } from './cache'
import type { AIProvider, AIProviderConfig } from '../ai/provider'
import { createRepositoryParser } from '../repository-analysis'
import type { ParsedRepository } from '../repository-analysis'
import { buildAnalysisPrompt } from '../ai/prompt'
import { parseAnalysisResponse } from '../ai/responseParser'

export interface AIAnalysisServiceOptions {
  provider: AIProvider
  cache: AnalysisCache
  /** Override token budget passed to RepositoryParser. Default: 60 000. */
  tokenBudget?: number
  /** Override model parameters forwarded to the provider. */
  providerConfig?: AIProviderConfig
}

export class AIAnalysisService implements AnalysisService {
  private readonly provider: AIProvider
  private readonly cache: AnalysisCache
  private readonly providerConfig: AIProviderConfig
  private readonly tokenBudget: number

  constructor(options: AIAnalysisServiceOptions) {
    this.provider = options.provider
    this.cache    = options.cache
    this.providerConfig = options.providerConfig ?? {
      maxOutputTokens: 8000,
      temperature: 0.2,
    }
    this.tokenBudget = options.tokenBudget ?? 60_000
  }

  async analyze(request: RepositoryAnalysisRequest): Promise<RepositoryAnalysis> {
    // ------------------------------------------------------------------
    // 1. Parse the repository into structured context (skip if pre-parsed)
    // ------------------------------------------------------------------
    let parsed: ParsedRepository
    if (request.parsedRepo) {
      parsed = request.parsedRepo as ParsedRepository
    } else {
      const parser = createRepositoryParser({ tokenBudget: this.tokenBudget })
      parsed = await parser.parse(request.input)
    }

    // ------------------------------------------------------------------
    // 2. Cache lookup — skip the LLM call if we already have the result
    // ------------------------------------------------------------------
    const cached = await this.cache.get(parsed.fingerprint)
    if (cached) {
      return cached
    }

    // ------------------------------------------------------------------
    // 3. Build the LLM prompt
    // ------------------------------------------------------------------
    const { systemMessage, userMessage } = buildAnalysisPrompt({ parsed })

    // ------------------------------------------------------------------
    // 4. Call the AI provider
    // ------------------------------------------------------------------
    const aiResponse = await this.provider.complete(
      [
        { role: 'system', content: systemMessage },
        { role: 'user',   content: userMessage  },
      ],
      this.providerConfig,
    )

    // ------------------------------------------------------------------
    // 5. Parse and validate the response
    // ------------------------------------------------------------------
    const { analysis } = parseAnalysisResponse(
      aiResponse.content,
      request.repository.id,
      parsed.name,
    )

    // ------------------------------------------------------------------
    // 6. Store in cache keyed by repository fingerprint
    // ------------------------------------------------------------------
    await this.cache.set(parsed.fingerprint, analysis)

    return analysis
  }
}
