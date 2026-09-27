import type { Repository, RepositoryInput } from '../../types'

export interface RepositoryService {
  loadDemo(): Promise<RepositoryInput>
  readZip(file: File): Promise<RepositoryInput>
}

export class BrowserRepositoryService implements RepositoryService {
  private readonly demoSource?: () => Promise<RepositoryInput>

  constructor(demoSource?: () => Promise<RepositoryInput>) {
    this.demoSource = demoSource
  }

  async loadDemo(): Promise<RepositoryInput> {
    if (!this.demoSource) {
      throw new Error('A demo repository source has not been configured yet.')
    }

    return this.demoSource()
  }

  async readZip(file: File): Promise<RepositoryInput> {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      throw new Error('Choose a ZIP archive to continue.')
    }

    if (file.size === 0) {
      throw new Error('The selected ZIP archive is empty.')
    }

    return {
      kind: 'zip',
      name: file.name.replace(/\.zip$/i, ''),
      archive: file,
      metadata: {
        fileName: file.name,
        sizeBytes: file.size,
        lastModified: file.lastModified,
      },
    }
  }
}

export function createRepositoryFromInput(input: RepositoryInput): Repository {
  const now = new Date().toISOString()

  return {
    id: `${input.kind}-${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name: input.name,
    source: input.kind === 'zip' ? 'archive' : 'local',
    status: 'connected',
    createdAt: now,
    updatedAt: now,
    metadata: input.metadata,
  }
}
