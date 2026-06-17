# Codebase Summary — Vit CLI

## Overview

Vit CLI (`vit`) is a modular TypeScript CLI for installing and managing Vit Engine — a private GitHub repository of standardized AI development patterns. The codebase emphasizes **domain-driven design**, **idempotent file reconciliation**, and **cross-platform shell integration** (PowerShell, Bash, Zsh).

**Key Stats**:
- **Language**: TypeScript (strict mode), compiled to ES modules
- **Framework**: CAC (command-line argument parser)
- **Commands**: 7 top-level (init, update, plan, migrate, doctor, version, [plan subcommands])
- **Modules**: 50+ focused TypeScript files
- **Package.json Version**: 1.5.0
- **Node.js Target**: ≥18.0.0

## Project Structure

```
vit-cli/
├── bin/
│   └── vit.js                 # Binary entry point (after build)
├── src/
│   ├── index.ts               # CLI router (cac framework)
│   ├── commands/              # Command implementations
│   │   ├── init.ts            # `vit init` — install engine
│   │   ├── update.ts          # `vit update` — upgrade engine
│   │   ├── doctor.ts          # `vit doctor` — health check
│   │   ├── doctor-health-checks.ts # Health check modules
│   │   ├── version.ts         # `vit version` — print versions
│   │   ├── plan/              # Plan command group
│   │   │   ├── plan-command.ts    # Main router (create/check/uncheck/status)
│   │   │   ├── plan-scaffold.ts   # Plan file creation
│   │   │   └── plan-status.ts     # Status printer
│   │   ├── migrate/           # Migrate command
│   │   │   ├── migrate-command.ts # Main orchestrator
│   │   │   ├── migrate-display.ts # Output formatting
│   │   │   └── migrate-scope-resolver.ts # Provider resolution
│   │   └── portable/          # Multi-provider conversion
│   │       ├── migrate-discovery.ts # Discover items from .claude/
│   │       ├── migrate-installer.ts # Write to provider
│   │       ├── migrate-provider-registry.ts # Provider configs
│   │       ├── migrate-types.ts  # Shared types
│   │       ├── generated-context-hooks.ts # Filter non-portable hooks
│   │       ├── migrate-mode-validator.ts  # Validate option combos
│   │       └── converters/    # Format-specific converters
│   │           ├── migrate-converter-index.ts
│   │           ├── migrate-converter-direct-copy.ts
│   │           ├── migrate-converter-fm-to-fm.ts
│   │           ├── migrate-converter-md-strip.ts
│   │           ├── migrate-converter-command-to-codex-skill.ts
│   │           └── migrate-converter-codex-toml.ts
│   ├── fetch/                 # Download engine from GitHub
│   │   ├── tarball-extractor.ts # Extract .tar.gz, validate structure
│   │   └── (engine-asset-streamer in github/)
│   ├── github/                # GitHub API & token handling
│   │   ├── token-resolver.ts    # Resolve token (gh, GITHUB_TOKEN, explicit)
│   │   ├── engine-fetcher.ts    # Fetch engine release or branch
│   │   └── engine-asset-streamer.ts # Stream asset with progress
│   ├── install/               # Installation orchestration
│   │   ├── install-engine.ts    # Main `vit init` logic
│   │   ├── install-executor.ts  # Apply reconcile plan (write files)
│   │   ├── env-scaffold.ts      # Create .claude/.env
│   │   ├── settings/          # settings.json merge & processing
│   │   │   ├── settings-processor.ts
│   │   │   ├── settings-merger.ts
│   │   │   ├── command-normalizer.ts
│   │   │   ├── zombie-hook-pruner.ts
│   │   │   └── settings-types.ts
│   │   └── skills/            # Skill dependency installation
│   │       ├── skill-deps-installer.ts # Run install.sh / install.ps1
│   │       ├── skills-install-prompt.ts # Prompt user
│   │       ├── process-executor.ts
│   │       ├── script-path-validator.ts
│   │       └── install-error-display.ts
│   ├── reconcile/             # File reconciliation (checksum-based)
│   │   ├── reconciler.ts      # Pure reconciliation logic
│   │   ├── engine-manifest.ts # Load/synthesize manifest
│   │   ├── registry.ts        # Registry (installed state) I/O
│   │   ├── checksum.ts        # SHA-256 checksums
│   │   ├── reconcile-types.ts # ReconcileAction, ReconcilePlan
│   │   └── registry.ts        # Registry persistence
│   ├── shared/                # Cross-cutting utilities
│   │   ├── config.ts          # Static config (ENGINE_REPO, dirs)
│   │   ├── environment.ts     # isWindows(), isCIEnvironment(), etc
│   │   ├── logger.ts          # log.info, log.error, log.warn
│   │   ├── path-safety.ts     # safeResolve, hasDotDotSegment
│   │   ├── fs-retry.ts        # Retry wrapper for fs operations
│   │   ├── check-cli-update.ts # Check for new CLI version on npm
│   │   └── ui/                # Terminal UI rendering
│   │       ├── ui.ts          # Main UI facade (printPanel, intro, outro)
│   │       ├── spinner.ts     # createSpinner (ora wrapper)
│   │       ├── progress.ts    # createProgress (progress bar)
│   │       ├── panel.ts       # Panel rendering (bordered boxes)
│   │       ├── panel-tokens.ts # ANSI utilities (stripAnsi, wrapText)
│   │       └── ui-capabilities.ts # Terminal capability detection
│   └── __tests__/             # Unit tests (Jest/Node test runner)
├── dist/                      # Compiled output (git-ignored)
├── tsconfig.json              # TypeScript config (strict)
├── package.json               # Dependencies, scripts, bin entry
├── .github/workflows/         # CI/CD (GitHub Actions)
│   └── (semantic-release)
├── README.md                  # User-facing intro
└── docs/                      # Documentation (this directory)
```

## Module Responsibilities

### Commands Layer (`src/commands/`)

**Purpose**: Implement CLI command logic, delegate to install/fetch layers, handle UI interaction.

| Module | Role |
|--------|------|
| `index.ts` | CAC router, option parsing, error handling |
| `init.ts` | Orchestrate engine installation (calls installEngine) |
| `update.ts` | Orchestrate engine update (similar flow as init) |
| `doctor.ts` | Run health checks, display results |
| `doctor-health-checks.ts` | Individual health check functions |
| `version.ts` | Print CLI + engine version |
| `plan/plan-command.ts` | Route plan subcommands (create/check/uncheck/status) |
| `migrate/migrate-command.ts` | Migrate orchestrator + display results |

### Fetch & GitHub Layer (`src/fetch/`, `src/github/`)

**Purpose**: Download engine tarball from private GitHub repo, handle auth.

| Module | Role |
|--------|------|
| `github/token-resolver.ts` | Resolve GitHub token (gh, env, explicit) |
| `github/engine-fetcher.ts` | Fetch release asset or branch tarball |
| `github/engine-asset-streamer.ts` | Stream download with progress |
| `fetch/tarball-extractor.ts` | Extract .tar.gz, find .claude/ + root/ payloads |

### Installation Layer (`src/install/`)

**Purpose**: Install engine files, scaffold env, merge settings, install skill deps.

| Module | Role |
|--------|------|
| `install-engine.ts` | Main orchestrator: token → fetch → reconcile → execute |
| `install-executor.ts` | Apply reconcile plan (write files, update registry) |
| `env-scaffold.ts` | Create .claude/.env from .env.example |
| `settings/settings-processor.ts` | Load + process settings.json (merge, prune hooks) |
| `settings/settings-merger.ts` | Merge engine + user settings.json |
| `skills/skill-deps-installer.ts` | Run install.sh/install.ps1 for skill venv + npm |

### Reconciliation Layer (`src/reconcile/`)

**Purpose**: Pure logic for deciding which files to install/update/skip based on checksums.

| Module | Role |
|--------|------|
| `reconciler.ts` | Pure decision matrix (8 cases: new file, engine change, user edit, force, etc) |
| `engine-manifest.ts` | Load manifest from engine or synthesize from file tree |
| `registry.ts` | Registry I/O (read/write installed state) |
| `checksum.ts` | Content-addressable checksums (SHA-256) |
| `reconcile-types.ts` | `ReconcileAction`, `ReconcilePlan`, `EngineManifest` types |

### Multi-Provider Migrate (`src/commands/portable/`)

**Purpose**: Discover engine items from .claude/, convert to provider formats, install to external platforms.

| Module | Role |
|--------|------|
| `migrate-discovery.ts` | Discover agents, skills, commands, rules, hooks, settings from .claude/ |
| `migrate-provider-registry.ts` | Provider metadata (Codex TOML paths, OpenCode JSON structure) |
| `migrate-installer.ts` | Install converted items to provider |
| `migrate-types.ts` | `ConversionResult`, `PortableItem`, `SkillInfo`, provider types |
| `converters/*` | Format-specific converters (direct copy, frontmatter merge, Codex TOML) |

### UI Layer (`src/shared/ui/`)

**Purpose**: Terminal rendering — panels, spinners, progress bars, ANSI colors.

| Module | Role |
|--------|------|
| `ui.ts` | High-level API (printPanel, intro, outro, createSpinner, createProgress) |
| `spinner.ts` | Spinner handle (start, message, stop) |
| `progress.ts` | Progress bar (update, finish) |
| `panel.ts` | Render bordered panel with zones (title, label, lines) |
| `panel-tokens.ts` | ANSI utilities (stripAnsi, wrapText, truncateMiddle, paint colors) |

### Shared Utilities (`src/shared/`)

**Purpose**: Cross-cutting concerns (logging, env detection, path safety, config).

| Module | Role |
|--------|------|
| `config.ts` | Static config (ENGINE_REPO, RUNTIME_DIR, CACHE_DIR) |
| `environment.ts` | Predicates (isWindows, isCIEnvironment, isNonInteractive) |
| `logger.ts` | Structured logging with verbosity control |
| `path-safety.ts` | Prevent path traversal attacks (safeResolve, hasDotDotSegment) |
| `fs-retry.ts` | Retry wrapper for transient fs errors |
| `check-cli-update.ts` | Check npm for new CLI version |

## Main Flow Diagrams

### `vit init` Flow

```
User runs: vit init
  ↓
index.ts (CAC router)
  ↓
init.ts (runInit)
  ├─ 1. resolveToken() — get GitHub token
  ├─ 2. fetchEngine() — download + extract
  │   ├─ Octokit.repos.get() — verify access
  │   ├─ fetch release asset OR branch tarball
  │   ├─ extractTarball() — find .claude/ payload
  │   └─ checksum validation
  ├─ 3. loadOrSynthesizeManifest() — read manifest.json or scan .claude/
  ├─ 4. loadRegistry() — read ~/.vit/registry.json
  ├─ 5. loadTargetState() — checksum scan of .claude/ (if exists)
  ├─ 6. reconcile() — PURE: decide (install/update/skip) for each file
  ├─ 7. executeInstall() — apply plan (write files, update registry)
  │   ├─ scaffoldEnv() — create .claude/.env
  │   ├─ processSettings() — merge settings.json
  │   └─ updateRegistry() — record installed state
  ├─ 8. (optional) handleSkillsInstallation() — run install.sh/install.ps1
  └─ 9. printPanel() — "Cài đặt hoàn tất"
```

### `vit update` Flow

Similar to init, but:
- Registry already exists → reconciler detects conflicts (user-edited vs engine-changed)
- `--force` flag overrides user edits (with warning)
- Backup old `.claude/` before executing

### `vit migrate` Flow

```
User runs: vit migrate --agent codex --dry-run
  ↓
migrate-command.ts
  ├─ 1. validateOptions() — check mutual exclusions
  ├─ 2. resolveProviders() — parse --agent codex → [ProviderType]
  ├─ 3. discoverAll() — find agents, skills, commands, rules, hooks from .claude/
  ├─ 4. For each provider:
  │   ├─ discoverProvider() — provider-specific config
  │   ├─ For each item:
  │   │   ├─ selectConverter() — pick formatter (direct-copy, TOML, etc)
  │   │   └─ convert() → ConversionResult
  │   └─ install() → write to provider OR dry-run print
  └─ 5. printResults() — summary (installed/skipped/converted counts)
```

### Registry & Reconciliation

**Registry Format** (`~/.vit/registry.json`):
```json
{
  "version": "1",
  "installedVersion": "1.5.0",
  "files": {
    "path/to/file": {
      "sourceChecksum": "...",
      "targetChecksum": "..."
    }
  }
}
```

**Reconcile Decision Matrix**:
1. File new in manifest, not in target → **INSTALL**
2. File in manifest & target, checksums match → **SKIP**
3. Engine changed, user didn't → **UPDATE**
4. User changed, engine didn't → **SKIP** (unless `--force` → **UPDATE**)
5. Both changed → **CONFLICT** (ask user or `--force`)

## Key Patterns

### 1. Idempotent Installation

- Registry + checksums track state
- Multiple runs with same version = no-op
- `--force` flag for re-installation
- Reconciler is pure (no I/O)

### 2. Cross-Platform Shell Handling

- Detect OS: `isWindows()` → PowerShell script, else → Bash
- Script path validation: `validateScriptPath()`
- Process execution: `executeInteractiveScript()` captures stderr/stdout

### 3. Streaming Downloads

- Octokit stream-first, fallback to buffer
- Progress callbacks: `onDownloadProgress`, `onExtractEntry`
- Create progress bar on first chunk received (know total size then)

### 4. Domain-Driven Organization

Each domain (`fetch`, `install`, `reconcile`, etc.) has:
- Facade file re-exporting public API
- Internal modules <200 LOC each
- No circular dependencies
- Clear responsibility boundary

### 5. UI Isolation

- All terminal output goes through `shared/ui/`
- `logger.ts` for structured logs
- `printPanel()` for boxed output
- Spinners + progress bars auto-disable in non-TTY

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **CLI Framework** | CAC (argument parsing) |
| **Package Manager** | npm (dependencies in package.json) |
| **Runtime** | Node.js ≥18 |
| **Type System** | TypeScript 5.7.2 (strict) |
| **GitHub API** | @octokit/rest v21.1.1 |
| **Archive Handling** | tar v7.4.3, (no zip needed in v1.5.0) |
| **Prompts** | @clack/prompts v0.7.0 |
| **File I/O** | fs-extra v11.2.0 |
| **Colors** | picocolors v1.1.1 |
| **Linting** | Biome (config not visible) |
| **Release** | semantic-release v24.2.3 |

## Build & Distribution

### Build Process

```bash
npm run build
# Compiles src/ → dist/ via TypeScript
```

### Binary Entry Point

```javascript
// bin/vit.js (after build)
#!/usr/bin/env node
require('../dist/index.js');
```

Package.json exposes: `"bin": { "vit": "bin/vit.js" }`

### Publishing

- **Channel**: npm @truongqv12/vit-cli
- **Scope**: public (publishConfig.access)
- **Automation**: semantic-release on main merge
- **Version**: Conventional commits (feat:, fix:, etc)

## Code Standards (Key Rules)

1. **Module Size**: Keep source files <200 LOC (includes comments & tests)
2. **File Naming**: kebab-case for .ts files, self-documenting names
3. **No Circular Imports**: Use domain/facade pattern
4. **Path Safety**: Always use `path.join()`, not string concatenation
5. **Error Handling**: Wrap GitHub API in try-catch; verbose error messages in CLI
6. **Testing**: Jest test files co-located with source (or __tests__ folder)
7. **UI Output**: Never console.log directly; use logger + UI facades

## Testing Strategy

- Unit tests in `src/__tests__/` or alongside modules
- Test command exit codes via `process.exit()`
- Mock GitHub API via fixtures (not real calls in CI)
- Integration tests for reconciliation logic (pure functions)

## Unresolved Questions

None. Codebase stable as of v1.5.0 with clear domain boundaries and established patterns.
