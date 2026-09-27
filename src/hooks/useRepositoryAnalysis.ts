/**
 * useRepositoryAnalysis
 *
 * React hook that drives the full parse → cache-check → AI-analyze pipeline.
 *
 * States:
 *   idle       — no repository selected yet
 *   parsing    — RepositoryParser is running (fast, no AI)
 *   analyzing  — AI provider call in progress
 *   ready      — RepositoryAnalysis is available
 *   error      — something failed; error message available
 *
 * Fallback behaviour:
 *   If AI analysis fails, the hook enters the 'error' state but the
 *   most-recently-parsed ParsedRepository is still available for callers
 *   to render a degraded experience.
 *
 * Cache behaviour:
 *   On a cache hit the hook jumps directly from 'parsing' to 'ready'
 *   without going through 'analyzing'. The caller can inspect isCacheHit
 *   to show a "cached" indicator if desired.
 */

import { useCallback, useReducer } from 'react'
import type { RepositoryAnalysis, RepositoryInput, Repository } from '../types'
import type { ParsedRepository } from '../services/repository-analysis'
import type { AnalysisService } from '../services/analysis'
import { TieredAnalysisCache } from '../services/analysis'
import { createRepositoryParser } from '../services/repository-analysis'

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export type AnalysisStatus = 'idle' | 'parsing' | 'analyzing' | 'ready' | 'error'

export interface AnalysisState {
  status: AnalysisStatus
  parsedRepo: ParsedRepository | null
  analysis: RepositoryAnalysis | null
  error: string | null
  isCacheHit: boolean
}

type Action =
  | { type: 'PARSE_START' }
  | { type: 'PARSE_DONE'; parsed: ParsedRepository }
  | { type: 'ANALYZE_START' }
  | { type: 'ANALYZE_DONE'; analysis: RepositoryAnalysis; fromCache: boolean }
  | { type: 'FAIL'; error: string }
  | { type: 'RESET' }

const initialState: AnalysisState = {
  status: 'idle',
  parsedRepo: null,
  analysis: null,
  error: null,
  isCacheHit: false,
}

function reducer(state: AnalysisState, action: Action): AnalysisState {
  switch (action.type) {
    case 'PARSE_START':
      return { ...state, status: 'parsing', error: null }

    case 'PARSE_DONE':
      return { ...state, status: 'analyzing', parsedRepo: action.parsed }

    case 'ANALYZE_START':
      return { ...state, status: 'analyzing' }

    case 'ANALYZE_DONE':
      return {
        ...state,
        status: 'ready',
        analysis: action.analysis,
        isCacheHit: action.fromCache,
        error: null,
      }

    case 'FAIL':
      return { ...state, status: 'error', error: action.error }

    case 'RESET':
      return initialState
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseRepositoryAnalysisOptions {
  /** The AnalysisService to use. Pass undefined to disable AI analysis. */
  analysisService?: AnalysisService
  /** Token budget override for the repository parser. */
  tokenBudget?: number
}

export interface UseRepositoryAnalysisResult extends AnalysisState {
  /** Start the parse → analyze pipeline for the given input. */
  run(input: RepositoryInput, repository: Repository): Promise<void>
  /** Reset to idle state. */
  reset(): void
}

export function useRepositoryAnalysis(
  options: UseRepositoryAnalysisOptions = {},
): UseRepositoryAnalysisResult {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { analysisService, tokenBudget } = options

  const run = useCallback(
    async (input: RepositoryInput, repository: Repository): Promise<void> => {
      dispatch({ type: 'PARSE_START' })

      // ------------------------------------------------------------------
      // Step 1 — Parse the repository (pure, no AI)
      // ------------------------------------------------------------------
      let parsed: ParsedRepository
      try {
        const parser = createRepositoryParser({ tokenBudget })
        parsed = await parser.parse(input)
        dispatch({ type: 'PARSE_DONE', parsed })
      } catch (e) {
        dispatch({
          type: 'FAIL',
          error: e instanceof Error ? e.message : 'Repository parsing failed.',
        })
        return
      }

      // ------------------------------------------------------------------
      // Step 2 — Cache check (fast path, no AI call)
      // ------------------------------------------------------------------
      const cache = new TieredAnalysisCache()
      const cached = await cache.get(parsed.fingerprint)
      if (cached) {
        dispatch({ type: 'ANALYZE_DONE', analysis: cached, fromCache: true })
        return
      }

      // ------------------------------------------------------------------
      // Step 3 — AI analysis (only if a service is configured)
      // ------------------------------------------------------------------
      if (!analysisService) {
        // No AI service — remain in 'analyzing' so the caller can show a
        // "pending" state without treating the absence of AI as an error.
        dispatch({ type: 'ANALYZE_START' })
        return
      }

      dispatch({ type: 'ANALYZE_START' })
      try {
        // Pass the pre-parsed result so the service skips re-parsing.
        const analysis = await analysisService.analyze({ repository, input, parsedRepo: parsed })
        dispatch({ type: 'ANALYZE_DONE', analysis, fromCache: false })
      } catch (e) {
        dispatch({
          type: 'FAIL',
          error: e instanceof Error ? e.message : 'Repository analysis failed.',
        })
      }
    },
    [analysisService, tokenBudget],
  )

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  return { ...state, run, reset }
}
