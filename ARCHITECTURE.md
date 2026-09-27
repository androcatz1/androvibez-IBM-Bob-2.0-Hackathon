# Onboarding Quest — Architecture & Implementation Plan

> **Status:** Planning — no major implementation has started.
> This document describes the target architecture for the full product and identifies which parts can be built independently.

---

## Table of Contents

1. [Product Flow](#1-product-flow)
2. [Design Principles](#2-design-principles)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Components](#4-components)
5. [Services](#5-services)
6. [Data Flow](#6-data-flow)
7. [State Management](#7-state-management)
8. [Boundary Definitions](#8-boundary-definitions)
   - 8.1 [AI Boundary](#81-ai-boundary)
   - 8.2 [Repository Parsing Boundary](#82-repository-parsing-boundary)
   - 8.3 [Quest Generation Boundary](#83-quest-generation-boundary)
   - 8.4 [Adaptive Learning Boundary](#84-adaptive-learning-boundary)
9. [Caching Strategy](#9-caching-strategy)
10. [Parallel Agent Breakdown](#10-parallel-agent-breakdown)
11. [Implementation Phases](#11-implementation-phases)
12. [Open Questions](#12-open-questions)

---

## 1. Product Flow

```
User
  │
  ▼
Repository Setup          ← User provides a ZIP or connects a remote URL
  │
  ▼
Repository Ingestion      ← Files extracted, tree built, language/role detected
  │
  ▼
Repository Understanding  ← AI analysis: summary, architecture, concepts, objectives
  │                          Result cached by repository fingerprint
  ▼
AI-generated Onboarding   ← Quests, quiz questions, scenarios, contribution tasks
Journey                     generated once from the cached analysis
  │
  ▼
Interactive Quests        ← User works through quest steps in the frontend
  │
  ▼
Knowledge Assessment      ← Quiz and investigation results scored; gaps identified
  │
  ▼
Investigation             ← Scenario-guided codebase exploration
  │
  ▼
Change Impact Reasoning   ← Scenario presents a change; user maps affected areas
  │
  ▼
First Contribution        ← Small, well-scoped contribution task
  │
  ▼
Contribution Ready        ← Journey complete; knowledge gaps drive next path
```

---

## 2. Design Principles

| # | Principle | Implication |
|---|-----------|-------------|
| 1 | **Arbitrary repositories** | No repository-specific knowledge may be hard-coded. All content is derived from analysis. |
| 2 | **Dynamic generation** | Repository summaries, quests, quiz questions, and scenarios are produced by the AI service for each repository. |
| 3 | **Data-driven frontend** | UI components consume `RepositoryAnalysis` and related types from `src/types/index.ts`. No content strings live in component code. |
| 4 | **AI as a separate service** | The frontend calls `AnalysisService.analyze()`. The AI implementation lives entirely behind that interface. |
| 5 | **Single analysis pass** | The repository is sent to the LLM exactly once per unique repository fingerprint. All quests and content are derived from the returned `RepositoryAnalysis`. |
| 6 | **Cache-first** | Completed analyses are stored (initially in `localStorage`, later in a backend store) and reused on subsequent sessions. |
| 7 | **Adaptive learning** | Quest results feed `KnowledgeGap` records; future paths surface quests that address identified gaps. |

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (React + Vite)                                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Pages & Features                                        │   │
│  │  (repository, onboarding, quests, quiz, investigation,  │   │
│  │   change-impact, contribution)                          │   │
│  └──────────────┬───────────────────────────────────────────┘   │
│                 │ reads/dispatches                              │
│  ┌──────────────▼───────────────────────────────────────────┐   │
│  │  Application State  (src/state)                          │   │
│  │  RepositorySession · AnalysisSession · UserProgress      │   │
│  └──────┬────────────────────────────────┬──────────────────┘   │
│         │ calls                          │ calls                │
│  ┌──────▼──────────┐            ┌────────▼──────────────────┐   │
│  │ RepositoryService│            │  AnalysisService          │   │
│  │ (ingestion)      │            │  (AI boundary)            │   │
│  └──────┬──────────┘            └────────┬──────────────────┘   │
│         │                               │                       │
│  ┌──────▼──────────┐            ┌────────▼──────────────────┐   │
│  │ RepositoryParser │            │  AnalysisCache            │   │
│  │ (parsing boundary│            │  (localStorage / backend) │   │
│  └─────────────────┘            └───────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                           │
                                   HTTP / fetch
                                           │
                            ┌──────────────▼────────────────┐
                            │  Analysis Backend (optional)  │
                            │  POST /analyze                │
                            │  ↓                            │
                            │  LLM Provider (watsonx / etc) │
                            └───────────────────────────────┘
```

The analysis backend is **optional in the first phase** — a browser-side adapter calling an LLM API directly satisfies the `AnalysisService` interface and can be replaced later without touching the frontend.

---

## 4. Components

### 4.1 Layout Components (`src/components/layout/`)

| Component | Responsibility |
|-----------|---------------|
| `AppShell` | Outermost chrome; owns route rendering slot |
| `Sidebar` | Journey map navigation; reflects `UserProgress` |
| `TopNav` | Repository name, session badge, settings entry point |

### 4.2 Quest Components (`src/components/quest/`)

| Component | Responsibility |
|-----------|---------------|
| `QuestCard` | Journey-map tile showing quest title, status, estimated time |
| `QuestStepList` | Ordered list of `QuestStep` items with completion state |
| `QuestProgressRing` | Visual percent-complete indicator per quest |

### 4.3 UI Primitives (`src/components/ui/`)

| Component | Responsibility |
|-----------|---------------|
| `Button` | Styled action trigger |
| `Card` | Surface container |
| `PageHeader` | Eyebrow / title / description block |
| `ProgressBar` | Linear progress indicator |
| `StatusBadge` | Tone-colored label (active, neutral, complete, error) |
| `LoadingSpinner` | Indeterminate wait indicator |
| `Tooltip` | Inline contextual hint |

### 4.4 Feature Components

Each feature folder owns a vertical slice: its own components, hooks, and local state. Features compose primitives from `src/components/ui/`.

| Feature | Key Components |
|---------|---------------|
| `repository` | `RepositorySetup`, `RepositoryStatusCard` |
| `onboarding` | `OnboardingPathCard`, `JourneyStartPrompt` |
| `quests` | `ActiveQuestView`, `QuestStepView`, `QuestCompleteCard` |
| `quiz` | `QuizQuestion`, `AnswerOption`, `QuizResultSummary` |
| `investigation` | `InvestigationScenarioView`, `FindingsList` |
| `change-impact` | `ChangeImpactScenarioView`, `ImpactMapEditor` |
| `contribution` | `ContributionTaskView`, `AcceptanceCriteriaList` |

---

## 5. Services

### 5.1 `RepositoryService` (`src/services/repository/`)

**Already partially implemented.** Responsible for ingesting user-supplied repository sources.

```
interface RepositoryService {
  loadDemo(): Promise<RepositoryInput>
  readZip(file: File): Promise<RepositoryInput>
  // Future:
  cloneRemote(url: string, branch?: string): Promise<RepositoryInput>
}
```

**Boundary:** Returns a `RepositoryInput` with raw files. Does not analyse or interpret content.

### 5.2 `RepositoryParser` (`src/services/repository-analysis/`)

Transforms raw `RepositoryInput` files into a structured `ParsedRepository` suitable for AI consumption. Runs entirely in the browser (no LLM calls).

```
interface RepositoryParser {
  parse(input: RepositoryInput): Promise<ParsedRepository>
}

interface ParsedRepository {
  fingerprint: string          // SHA-256 of file paths + sizes
  fileTree: RepositoryFile[]
  fileContents: Map<ID, string>
  detectedLanguages: string[]
  estimatedTokenCount: number
}
```

**Boundary:** Pure file analysis. No AI. Produces the fingerprint used for cache lookup.

### 5.3 `AnalysisService` (`src/services/analysis/`)

**Interface already defined.** Accepts a `RepositoryAnalysisRequest` and returns a `RepositoryAnalysis`. The implementation detail (direct LLM call vs backend proxy) is hidden behind the interface.

```
interface AnalysisService {
  analyze(request: RepositoryAnalysisRequest): Promise<RepositoryAnalysis>
}
```

**Implementations to build:**

| Class | Description |
|-------|-------------|
| `UnconfiguredAnalysisService` | ✅ Already exists — throws for prototype phase |
| `BrowserLLMAnalysisService` | Calls an LLM API directly from the browser (dev/demo) |
| `BackendAnalysisService` | POSTs to `/api/analyze`; LLM call happens server-side |

### 5.4 `AnalysisCache` (`src/services/analysis/`)

Stores and retrieves completed `RepositoryAnalysis` objects by repository fingerprint. Prevents re-sending the full repository to the LLM.

```
interface AnalysisCache {
  get(fingerprint: string): Promise<RepositoryAnalysis | null>
  set(fingerprint: string, analysis: RepositoryAnalysis): Promise<void>
  invalidate(fingerprint: string): Promise<void>
}
```

**Implementations:**

| Class | Description |
|-------|-------------|
| `LocalStorageAnalysisCache` | Browser-local cache; sufficient for single-user sessions |
| `IndexedDBAnalysisCache` | Handles larger analysis payloads |
| `RemoteAnalysisCache` | Backend-backed; enables multi-device reuse (future) |

### 5.5 `QuestProgressService` (`src/services/`)

Persists and retrieves `UserProgress` including completed quests, quiz results, and knowledge gaps.

```
interface QuestProgressService {
  load(repositoryId: ID): Promise<UserProgress | null>
  save(progress: UserProgress): Promise<void>
  recordQuestResult(repositoryId: ID, result: QuestResult): Promise<UserProgress>
}
```

### 5.6 `AdaptiveLearningService` (`src/services/`)

Derives recommended next quests from accumulated `KnowledgeGap` records.

```
interface AdaptiveLearningService {
  recommend(
    progress: UserProgress,
    availableQuests: Quest[]
  ): Quest[]
}
```

**Boundary:** Runs in the browser. No LLM call required — gap-to-quest mapping uses the `KnowledgeGap.recommendedQuestIds` field populated during analysis.

---

## 6. Data Flow

### 6.1 Repository Setup → Ingestion → Analysis

```
User selects source
        │
        ▼
RepositoryService.loadDemo() | .readZip()
        │  RepositoryInput
        ▼
RepositoryParser.parse()
        │  ParsedRepository  (+ fingerprint)
        ▼
AnalysisCache.get(fingerprint)
        │
  ┌─────▴─────┐
  │ Cache hit  │ Cache miss
  │            │
  ▼            ▼
Return     AnalysisService.analyze(request)
cached          │  RepositoryAnalysis
Analysis        ▼
           AnalysisCache.set(fingerprint, analysis)
                │
                ▼
         Emit to application state
```

### 6.2 Quest Execution

```
AnalysisSession (holds RepositoryAnalysis)
        │
        ▼
WorkspacePage reads quests, questions, scenarios from analysis
        │
        ▼
User completes quest step
        │
        ▼
Feature component dispatches action to application state
        │
        ▼
QuestProgressService.recordQuestResult()
        │
        ▼
AdaptiveLearningService.recommend() → updates Sidebar journey map
```

### 6.3 Adaptive Path Update

```
QuestResult (score, knowledgeGapIds)
        │
        ▼
UserProgress.knowledgeGaps updated
        │
        ▼
AdaptiveLearningService.recommend()
        │  prioritised Quest[]
        ▼
Sidebar journey map re-renders with new ordering
```

---

## 7. State Management

The existing prototype uses local `useState` in `App.tsx`. The full product requires three distinct state domains:

### 7.1 State Domains

| Domain | Owner | Contents |
|--------|-------|----------|
| `RepositorySession` | `src/state/repositorySession.ts` | Active `Repository`, `RepositoryInput`, parse status |
| `AnalysisSession` | `src/state/analysisSession.ts` | Active `RepositoryAnalysis`, loading state, cache hit flag |
| `UserJourney` | `src/state/userJourney.ts` | `UserProgress`, current quest, quiz answers, knowledge gaps |

### 7.2 Recommended Approach

Use React Context + `useReducer` for each domain, co-located in `src/state/`. This avoids adding an external state library while keeping reducers testable. Each domain exposes:

- A context provider (`<RepositorySessionProvider>`)
- A typed dispatch hook (`useRepositorySession()`)
- A selector hook (`useRepositorySessionData()`)

### 7.3 Persistence

`UserJourney` state is persisted via `QuestProgressService` on each meaningful action. `AnalysisSession` is re-hydrated from `AnalysisCache` on mount.

---

## 8. Boundary Definitions

### 8.1 AI Boundary

**Entry point:** `AnalysisService.analyze(request: RepositoryAnalysisRequest): Promise<RepositoryAnalysis>`

**What crosses the boundary inbound:**
- Repository file tree (paths, languages, roles)
- File contents (selected important files, respecting token budget)
- Requested output schema (`RepositoryAnalysis`)

**What crosses the boundary outbound:**
- A fully typed `RepositoryAnalysis` object
- All quests, quiz questions, investigation scenarios, change-impact scenarios, and contribution tasks embedded inside it

**What never crosses the boundary:**
- UI rendering logic
- Routing decisions
- User progress or quiz answers

**Prompt strategy (to be detailed in `src/services/ai/README.md`):**
1. System prompt defines the full `RepositoryAnalysis` output schema as JSON.
2. User message contains the file tree, selected file contents, and explicit instructions.
3. Response is parsed and validated against the TypeScript types before being stored.

### 8.2 Repository Parsing Boundary

**Entry point:** `RepositoryParser.parse(input: RepositoryInput): Promise<ParsedRepository>`

**Responsibilities inside this boundary:**
- Unzip archives (browser `DecompressionStream` or `fflate`)
- Walk the file tree; classify files by extension and path pattern
- Assign `RepositoryFile.role`, `isEntryPoint`, `isTest`, `isDocumentation`
- Compute a stable `fingerprint` (SHA-256 of sorted `path:size` pairs)
- Estimate token counts to inform which files to include in the AI prompt

**Responsibilities outside this boundary:**
- Understanding what the code means (AI boundary)
- Displaying file trees (feature components)

### 8.3 Quest Generation Boundary

Quest generation is **not a separate runtime service** — quests are embedded in the `RepositoryAnalysis` returned by the AI boundary. However, the generation logic (prompt construction, schema enforcement) is encapsulated in `src/services/ai/`.

The frontend treats `RepositoryAnalysis.quests` as the authoritative quest list. It never generates or mutates quest definitions; it only records user progress against them.

**Future extension:** A `QuestRefinementService` could call the AI with a specific `Quest` and user performance data to dynamically generate follow-up steps. This would add a second, narrower AI call scoped to one quest rather than the whole repository.

### 8.4 Adaptive Learning Boundary

**Entry point:** `AdaptiveLearningService.recommend(progress, quests): Quest[]`

**What this boundary does:**
- Reads `UserProgress.knowledgeGaps` (gap severity, related objectives)
- Cross-references `KnowledgeGap.recommendedQuestIds` populated during AI analysis
- Sorts available quests by gap severity and prerequisite satisfaction
- Returns an ordered `Quest[]` for the Sidebar and dashboard

**What this boundary does not do:**
- Call the AI (all gap→quest mappings were established during analysis)
- Modify quest definitions
- Track time spent or session count (that is `QuestProgressService`)

**Future extension:** Replace the rule-based recommender with an AI call that receives the user's full performance history and returns a personalised path. The `AdaptiveLearningService` interface remains unchanged.

---

## 9. Caching Strategy

### 9.1 Repository Fingerprint

A fingerprint is computed during parsing as a deterministic hash of the repository content:

```
fingerprint = SHA-256(
  sorted(file.path + ':' + file.sizeBytes).join('\n')
)
```

This is stable for the same ZIP and changes when any file is added, removed, or modified.

### 9.2 Cache Tiers

| Tier | Mechanism | Scope | Expiry |
|------|-----------|-------|--------|
| Memory | `Map<fingerprint, RepositoryAnalysis>` in module scope | Tab session | Page reload |
| `localStorage` | JSON-serialised analysis keyed by fingerprint | Browser profile | Manual invalidation |
| `IndexedDB` | Structured storage for large analyses | Browser profile | Manual or TTL |
| Remote (future) | REST endpoint; keyed by fingerprint | User account | Server-controlled TTL |

### 9.3 Cache Invalidation

- The user can force a re-analysis from the UI ("Re-analyse repository").
- If the repository fingerprint changes (new ZIP), the old cache entry is left intact and a new one is created.
- A `version` field in `RepositoryAnalysis` allows stale entries produced by an older prompt version to be detected and refreshed.

---

## 10. Parallel Agent Breakdown

The following workstreams have **no implementation dependencies on each other** and can be assigned to parallel agents:

| Agent | Workstream | Files / Folders | Dependencies |
|-------|-----------|----------------|--------------|
| **A** | Repository Parser | `src/services/repository-analysis/` | Types only |
| **B** | Analysis Cache | `src/services/analysis/cache.ts` | Types only |
| **C** | AI Prompt & Service | `src/services/ai/`, `src/services/analysis/` | Types + Cache interface |
| **D** | Application State | `src/state/` | Types only |
| **E** | Quest Feature UI | `src/features/quests/` | State interface, types |
| **F** | Quiz Feature UI | `src/features/quiz/` | State interface, types |
| **G** | Investigation Feature UI | `src/features/investigation/` | State interface, types |
| **H** | Change Impact Feature UI | `src/features/change-impact/` | State interface, types |
| **I** | Contribution Feature UI | `src/features/contribution/` | State interface, types |
| **J** | Adaptive Learning Service | `src/services/` (AdaptiveLearningService) | State interface, types |
| **K** | Quest Progress Service | `src/services/` (QuestProgressService) | State interface, types |

**Integration order:**

```
Phase 1 (parallel): A, B, D
Phase 2 (parallel): C (needs B), E–I (need D), J, K (need D)
Phase 3:            Wire C + A + B into AnalysisSession
                    Wire D + E–K into App
Phase 4:            End-to-end flow test; adaptive path enabled
```

---

## 11. Implementation Phases

### Phase 1 — Foundation (no AI yet)

Goals: parser works, cache works, state shape is established.

- [ ] `RepositoryParser` — unzip, classify, fingerprint, token count
- [ ] `LocalStorageAnalysisCache` — get / set / invalidate
- [ ] State domain providers: `RepositorySessionProvider`, `AnalysisSessionProvider`, `UserJourneyProvider`
- [ ] Wire state into `App.tsx`; remove ad-hoc `useState` for routing and `demoMode`
- [ ] `QuestProgressService` backed by `localStorage`

### Phase 2 — AI Integration

Goals: real analysis replaces demo data.

- [ ] Prompt engineering in `src/services/ai/` — system prompt, schema enforcement, file selection strategy
- [ ] `BrowserLLMAnalysisService` with configurable API key from `src/config/`
- [ ] Cache-first flow: parse → fingerprint → cache lookup → conditional AI call → cache store
- [ ] Replace `demoData` dependency in `WorkspacePage` with live `AnalysisSession`

### Phase 3 — Interactive Quests

Goals: all quest feature UI is wired to live analysis data.

- [ ] `ActiveQuestView` — renders `Quest` steps from `AnalysisSession`
- [ ] `QuizQuestion` + answer selection, scoring, gap recording
- [ ] `InvestigationScenarioView` — renders prompts, records findings
- [ ] `ChangeImpactScenarioView` — renders scenario, captures user map
- [ ] `ContributionTaskView` — acceptance criteria, completion action

### Phase 4 — Adaptive Learning

Goals: knowledge gaps drive the next path.

- [ ] `AdaptiveLearningService.recommend()` — gap-severity ordering
- [ ] Sidebar re-orders journey map based on recommendations
- [ ] Dashboard surfaces top knowledge gap with recommended quest
- [ ] `QuestRefinementService` (stretch) — targeted follow-up quest generation

### Phase 5 — Backend & Multi-user (stretch)

- [ ] Express / Hono analysis API endpoint
- [ ] `BackendAnalysisService` replacing browser LLM calls
- [ ] `RemoteAnalysisCache` (Redis / Postgres)
- [ ] User authentication; per-user `UserProgress` persistence

---

## 12. Open Questions

| # | Question | Impact |
|---|----------|--------|
| 1 | Which LLM provider is used for analysis? | Determines `BrowserLLMAnalysisService` implementation and token limits |
| 2 | What is the maximum ZIP size to support? | Determines file-selection strategy and token budget in prompt |
| 3 | Should analysis run client-side or server-side first? | Determines whether Phase 2 needs a backend or can stay browser-only |
| 4 | Is user identity required in Phase 1? | Determines whether `QuestProgressService` can be anonymous (localStorage) |
| 5 | What scoring model is used for quizzes? | Determines `QuestResult.score` calculation and gap severity thresholds |
| 6 | Should investigation findings be AI-evaluated? | Would add a second AI call boundary for freeform answers |
