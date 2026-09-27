# Onboarding Quest

An AI-powered developer onboarding tool that turns any software repository into a guided learning journey — from first clone to first contribution.

## Quick Start

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` and use **Try demo** to explore the prototype with sample data.

## Documentation

| Document | Description |
|----------|-------------|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Full architecture and implementation plan — components, services, data flow, AI boundaries, caching strategy, and parallel agent breakdown |

## Project Structure

```
src/
  components/     Reusable UI primitives and layout chrome
  features/       Domain feature slices (repository, quests, quiz, investigation, …)
  services/       Integration boundaries (repository ingestion, AI analysis, caching)
  state/          Application state ownership (journey progress, repository session)
  data/           Demo fixtures and development data
  types/          Shared TypeScript contracts
  pages/          Route-level views
  hooks/          Reusable React hooks
  utils/          Small pure helpers
  config/         Environment-aware configuration
```

## Tech Stack

- React 19 + TypeScript
- Vite 8
- Oxlint

## Development

```bash
npm run lint    # Run Oxlint
npm run build   # Type-check + production build
npm run preview # Preview production build
```
