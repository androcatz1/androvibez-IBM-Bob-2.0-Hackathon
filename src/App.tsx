import { useState, useCallback } from 'react'
import { AppShell } from './components/layout/AppShell'
import { demoRepositoryService } from './data/demo'
import { HomePage, SetupPage, WorkspacePage } from './pages'
import { createAnalysisService } from './services/analysis'
import { createAIProvider } from './services/ai/provider'
import { useRepositoryAnalysis } from './hooks/useRepositoryAnalysis'
import type { RepositoryInput, Repository } from './types'
import type { AllStageResults, ContributionStageResult } from './features/onboarding/adaptiveProgress'
import './App.css'

// ---------------------------------------------------------------------------
// AI provider — resolved once from environment variables at module load.
//
// To enable AI analysis in development, create a .env.local file with ONE
// of the following configurations. API keys never appear in committed source.
//
// Backend proxy (recommended for production — key stays server-side):
//   VITE_AI_PROVIDER=backend-proxy
//   VITE_AI_PROXY_URL=https://your-server.example.com/api/analyze
//
// OpenAI-compatible (e.g. local model server, user's own key):
//   VITE_AI_PROVIDER=openai-compatible
//   VITE_OPENAI_BASE_URL=https://api.openai.com/v1
//   VITE_OPENAI_API_KEY=sk-...
//   VITE_OPENAI_MODEL=gpt-4o-mini
//
// IBM watsonx.ai (user's own IAM token):
//   VITE_AI_PROVIDER=watsonx
//   VITE_WATSONX_BASE_URL=https://us-south.ml.cloud.ibm.com
//   VITE_WATSONX_TOKEN=<iam-token>
//   VITE_WATSONX_PROJECT=<project-id>
//   VITE_WATSONX_MODEL=ibm/granite-34b-code-instruct
//
// If no env vars are set, analysis stays in the unconfigured/pending state.
// ---------------------------------------------------------------------------

function resolveAIProvider() {
  const kind = import.meta.env.VITE_AI_PROVIDER as string | undefined

  if (kind === 'backend-proxy') {
    const proxyUrl = import.meta.env.VITE_AI_PROXY_URL as string | undefined
    if (!proxyUrl) return undefined
    return createAIProvider({ kind: 'backend-proxy', proxyUrl })
  }

  if (kind === 'openai-compatible') {
    const baseUrl = import.meta.env.VITE_OPENAI_BASE_URL as string | undefined
    const apiKey  = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
    const model   = import.meta.env.VITE_OPENAI_MODEL as string | undefined
    if (!baseUrl || !apiKey || !model) return undefined
    return createAIProvider({ kind: 'openai-compatible', openai: { baseUrl, apiKey, model } })
  }

  if (kind === 'watsonx') {
    const baseUrl   = import.meta.env.VITE_WATSONX_BASE_URL as string | undefined
    const iamToken  = import.meta.env.VITE_WATSONX_TOKEN as string | undefined
    const projectId = import.meta.env.VITE_WATSONX_PROJECT as string | undefined
    const modelId   = import.meta.env.VITE_WATSONX_MODEL as string | undefined
    if (!baseUrl || !iamToken || !projectId || !modelId) return undefined
    return createAIProvider({ kind: 'watsonx', watsonx: { baseUrl, iamToken, projectId, modelId } })
  }

  return undefined
}

// Module-level singletons so provider and service are stable across re-renders.
const aiProvider      = resolveAIProvider()
const analysisService = createAnalysisService(aiProvider)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRepository(input: RepositoryInput): Repository {
  return {
    id: `repo-${Date.now()}`,
    name: input.name,
    source: input.kind === 'zip' ? 'archive' : input.kind === 'demo' ? 'local' : 'unknown',
    status: 'analyzing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App() {
  const [route, setRoute] = useState('home')
  const [completedStageIds, setCompletedStageIds] = useState<string[]>([])
  const [allStageResults, setAllStageResults] = useState<AllStageResults>({})

  const analysisState = useRepositoryAnalysis({
    // Only pass analysisService when a provider is configured, so the hook
    // stays in 'analyzing' (pending) state rather than showing an error.
    analysisService: aiProvider ? analysisService : undefined,
  })

  async function handleRepositoryReady(input: RepositoryInput) {
    setRoute('dashboard')
    await analysisState.run(input, buildRepository(input))
  }

  const handleStageComplete = useCallback((stageId: string, result?: ContributionStageResult) => {
    setCompletedStageIds((prev) =>
      prev.includes(stageId) ? prev : [...prev, stageId]
    )
    if (stageId === 'contribution' && result) {
      setAllStageResults((prev) => ({ ...prev, contribution: result }))
    }
    // Contribution stage shows its own ready screen — don't navigate away
    if (stageId !== 'contribution') {
      setRoute('dashboard')
    }
  }, [])

  const page = route === 'home'
    ? <HomePage onNavigate={setRoute} />
    : route === 'setup'
      ? <SetupPage repositoryService={demoRepositoryService} onReady={handleRepositoryReady} />
      : <WorkspacePage
          route={route}
          onNavigate={setRoute}
          analysisState={analysisState}
          completedStageIds={completedStageIds}
          allStageResults={allStageResults}
          onStageComplete={handleStageComplete}
        />

  return (
    <AppShell route={route} onNavigate={setRoute}>{page}</AppShell>
  )
}

export default App
