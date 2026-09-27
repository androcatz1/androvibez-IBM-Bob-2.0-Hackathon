import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button, Card, StatusBadge } from '../../components/ui'
import { BrowserRepositoryService } from '../../services/repository'
import type { RepositoryService } from '../../services/repository'
import type { RepositoryInput } from '../../types'

type SetupState = 'idle' | 'loading' | 'ready' | 'error'

export function RepositorySetup({ onReady, repositoryService = new BrowserRepositoryService() }: { onReady: (input: RepositoryInput) => void; repositoryService?: RepositoryService }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<SetupState>('idle')
  const [input, setInput] = useState<RepositoryInput | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDemo() {
    setState('loading')
    setError(null)
    try {
      const demoInput = await repositoryService.loadDemo()
      setInput(demoInput)
      setState('ready')
    } catch (demoError) {
      setError(demoError instanceof Error ? demoError.message : 'The demo repository could not be loaded.')
      setState('error')
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setState('loading')
    setError(null)
    try {
      const zipInput = await repositoryService.readZip(file)
      setInput(zipInput)
      setState('ready')
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'The repository could not be read.')
      setState('error')
    }
  }

  return <Card className="setup-card repository-setup"><div className="setup-icon">⌘</div><div className="setup-heading"><div><h2>Select a repository</h2><p>Choose a replaceable source for this onboarding session.</p></div>{state === 'ready' && <StatusBadge tone="complete">Ready</StatusBadge>}</div><div className="repository-actions"><button className="repository-choice" onClick={handleDemo} disabled={state === 'loading'}><span className="choice-icon">✦</span><span><b>Try demo</b><small>Use an injected demo source</small></span><span className="choice-arrow">→</span></button><button className="repository-choice" onClick={() => fileInputRef.current?.click()} disabled={state === 'loading'}><span className="choice-icon">↑</span><span><b>Upload repository</b><small>Choose a ZIP archive from your device</small></span><span className="choice-arrow">→</span></button><input ref={fileInputRef} type="file" accept=".zip,application/zip" hidden onChange={handleFileChange} /></div>{state === 'loading' && <div className="setup-feedback" role="status"><span className="spinner" /> Reading repository source...</div>}{state === 'error' && <div className="setup-feedback feedback-error" role="alert"><strong>Could not select repository.</strong><span>{error}</span></div>}{state === 'idle' && <div className="setup-empty">No repository selected yet.</div>}{state === 'ready' && input && <div className="setup-ready"><div><span className="card-label">Selected source</span><strong>{input.name}</strong><small>{input.kind === 'zip' ? 'ZIP archive validated locally' : 'Demo source loaded'}</small></div><Button onClick={() => onReady(input)}>Continue to workspace <span>→</span></Button></div>}</Card>
}
