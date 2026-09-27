/**
 * AI Provider abstraction.
 *
 * All LLM communication is routed through the AIProvider interface so that
 * the backing model (watsonx, OpenAI, proxy, etc.) can be swapped without
 * touching the analysis layer.
 *
 * API keys are NEVER read from frontend source code. Providers expect either:
 *   a) a runtime-injected configuration object (e.g. from an environment
 *      variable exposed through a build-time VITE_* env var that the user
 *      explicitly opts into), or
 *   b) a backend proxy URL that holds the secret server-side.
 *
 * The recommended production path is (b): deploy a thin proxy and configure
 * BackendProxyProvider with its URL. No key ever enters the browser bundle.
 */

// ---------------------------------------------------------------------------
// Core interface
// ---------------------------------------------------------------------------

export interface AIProviderConfig {
  /** Maximum tokens the model may generate in the response. */
  maxOutputTokens?: number
  /** Temperature (0 = deterministic, 1 = creative). */
  temperature?: number
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIResponse {
  content: string
  /** Tokens consumed, if the provider reports it. */
  inputTokens?: number
  outputTokens?: number
}

/**
 * Minimal provider interface. Implementations may wrap watsonx, OpenAI,
 * Anthropic, a local model, or a backend proxy.
 */
export interface AIProvider {
  /** Human-readable identifier for logging/debugging. */
  readonly id: string
  /** Send a chat-completion request and resolve with the text response. */
  complete(messages: AIMessage[], config?: AIProviderConfig): Promise<AIResponse>
}

// ---------------------------------------------------------------------------
// BackendProxyProvider — recommended for production
// ---------------------------------------------------------------------------

/**
 * Sends analysis requests to a thin server-side proxy that holds the actual
 * LLM API key. The proxy receives `{ messages, config }` and returns
 * `{ content, inputTokens?, outputTokens? }`.
 *
 * This is the safest option: no API key is ever present in the browser.
 */
export class BackendProxyProvider implements AIProvider {
  readonly id = 'backend-proxy'
  private readonly url: string

  constructor(proxyUrl: string) {
    this.url = proxyUrl
  }

  async complete(messages: AIMessage[], config?: AIProviderConfig): Promise<AIResponse> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, config }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      throw new Error(`AI proxy responded ${response.status}: ${text}`)
    }

    const data = await response.json() as AIResponse
    return data
  }
}

// ---------------------------------------------------------------------------
// OpenAICompatibleProvider — direct call (dev/demo only)
// ---------------------------------------------------------------------------

/**
 * Calls any OpenAI-compatible chat-completion endpoint directly from the
 * browser. Suitable for local development against a local model server or
 * an API key the developer explicitly provides at runtime.
 *
 * Do NOT hard-code an API key in source. Pass it at runtime via an injected
 * config object or VITE_* env var that the developer sets in `.env.local`.
 *
 * Example:
 *   new OpenAICompatibleProvider({
 *     baseUrl: 'https://api.openai.com/v1',
 *     apiKey: import.meta.env.VITE_OPENAI_KEY,  // user's own .env.local
 *     model: 'gpt-4o-mini',
 *   })
 */
export interface OpenAICompatibleConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly id: string
  private readonly config: OpenAICompatibleConfig

  constructor(config: OpenAICompatibleConfig) {
    this.config = config
    this.id = `openai-compatible:${config.model}`
  }

  async complete(messages: AIMessage[], config?: AIProviderConfig): Promise<AIResponse> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        max_tokens: config?.maxOutputTokens ?? 8000,
        temperature: config?.temperature ?? 0.2,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      throw new Error(`OpenAI-compatible API responded ${response.status}: ${text}`)
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>
      usage?: { prompt_tokens: number; completion_tokens: number }
    }

    const content = data.choices[0]?.message?.content ?? ''
    return {
      content,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    }
  }
}

// ---------------------------------------------------------------------------
// WatsonxProvider — IBM watsonx.ai (direct, dev/demo only)
// ---------------------------------------------------------------------------

/**
 * Calls IBM watsonx.ai text generation directly from the browser.
 * As with OpenAICompatibleProvider, the IAM token must be supplied at
 * runtime — never hard-coded.
 *
 * Example:
 *   new WatsonxProvider({
 *     baseUrl: 'https://us-south.ml.cloud.ibm.com',
 *     iamToken: import.meta.env.VITE_WATSONX_TOKEN,
 *     projectId: import.meta.env.VITE_WATSONX_PROJECT,
 *     modelId: 'ibm/granite-34b-code-instruct',
 *   })
 */
export interface WatsonxConfig {
  baseUrl: string
  iamToken: string
  projectId: string
  modelId: string
  apiVersion?: string
}

export class WatsonxProvider implements AIProvider {
  readonly id: string
  private readonly config: WatsonxConfig

  constructor(config: WatsonxConfig) {
    this.config = config
    this.id = `watsonx:${config.modelId}`
  }

  async complete(messages: AIMessage[], config?: AIProviderConfig): Promise<AIResponse> {
    // Build a single prompt string by concatenating system + user messages
    const prompt = messages
      .map((m) => {
        if (m.role === 'system') return `[SYSTEM]\n${m.content}`
        if (m.role === 'user')   return `[USER]\n${m.content}`
        return `[ASSISTANT]\n${m.content}`
      })
      .join('\n\n')

    const version = this.config.apiVersion ?? '2023-05-29'
    const url = `${this.config.baseUrl}/ml/v1/text/generation?version=${version}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.iamToken}`,
      },
      body: JSON.stringify({
        model_id: this.config.modelId,
        project_id: this.config.projectId,
        input: prompt,
        parameters: {
          max_new_tokens: config?.maxOutputTokens ?? 8000,
          temperature: config?.temperature ?? 0.2,
        },
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      throw new Error(`watsonx.ai responded ${response.status}: ${text}`)
    }

    const data = await response.json() as {
      results?: Array<{ generated_text: string }>
      usage?: { input_token_count: number; generated_token_count: number }
    }

    const content = data.results?.[0]?.generated_text ?? ''
    return {
      content,
      inputTokens: data.usage?.input_token_count,
      outputTokens: data.usage?.generated_token_count,
    }
  }
}

// ---------------------------------------------------------------------------
// createAIProvider factory
// ---------------------------------------------------------------------------

export type AIProviderKind = 'backend-proxy' | 'openai-compatible' | 'watsonx'

export interface AIProviderOptions {
  kind: AIProviderKind
  /** Required for 'backend-proxy'. */
  proxyUrl?: string
  /** Required for 'openai-compatible'. */
  openai?: OpenAICompatibleConfig
  /** Required for 'watsonx'. */
  watsonx?: WatsonxConfig
}

/**
 * Factory function that creates the correct AIProvider from an options bag.
 * Centralises provider selection so callers never import concrete classes.
 */
export function createAIProvider(options: AIProviderOptions): AIProvider {
  switch (options.kind) {
    case 'backend-proxy':
      if (!options.proxyUrl) throw new Error('backend-proxy requires proxyUrl')
      return new BackendProxyProvider(options.proxyUrl)

    case 'openai-compatible':
      if (!options.openai) throw new Error('openai-compatible requires openai config')
      return new OpenAICompatibleProvider(options.openai)

    case 'watsonx':
      if (!options.watsonx) throw new Error('watsonx requires watsonx config')
      return new WatsonxProvider(options.watsonx)
  }
}
