# System Architecture — Vit CLI

## High-Level Architecture

Vit CLI is built around **three pillars**:

1. **Command Layer** — User-facing CLI commands (init, update, doctor, migrate, plan)
2. **Engine Pipeline** — Token resolution → Fetch → Reconcile → Install
3. **Multi-Provider Export** — Convert .claude/ to external provider formats

```
┌─────────────────────────────────────────────────────────────┐
│                  User: vit init / vit update                │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  Command Router (CAC Framework)                             │
│  index.ts: Parses args, dispatches to command handlers      │
└────────────────────────┬────────────────────────────────────┘
                         │
     ┌───────────────────┼───────────────────┐
     │                   │                   │
     ▼                   ▼                   ▼
  ┌──────┐         ┌──────────┐        ┌──────────┐
  │ init │         │  update  │        │  migrate │
  └──────┘         └──────────┘        └──────────┘
     │                   │                   │
     └───────────────────┼───────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  Installation Pipeline (install-engine.ts)                  │
│  1. Resolve Token (gh, GITHUB_TOKEN, explicit)             │
│  2. Fetch Engine (GitHub releases or branch)               │
│  3. Extract Tarball (find .claude/ + root/ payloads)       │
│  4. Load Manifest & Registry                               │
│  5. Reconcile (pure logic: decide install/update/skip)     │
│  6. Execute Install (write files, update registry)         │
│  7. Scaffold Env (.claude/.env from template)              │
│  8. Merge Settings (settings.json + zombie-hook cleanup)   │
│  9. Install Skill Deps (run install.sh / install.ps1)      │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram (Init Flow)

```
User: vit init
  │
  ├─> Token Resolver
  │   ├─ Try: gh auth token
  │   ├─ Try: GITHUB_TOKEN env var
  │   └─ Fallback: ask user to run `gh auth login`
  │
  ├─> Engine Fetcher
  │   ├─ Verify access (Octokit.repos.get)
  │   ├─ Try: fetch release asset (.tar.gz)
  │   │  └─ Stream download with onDownloadProgress callback
  │   └─ Fallback: fetch branch tarball (slower)
  │
  ├─> Tarball Extractor
  │   ├─ Extract to temp directory
  │   ├─ Find .claude/ payload (engine files)
  │   ├─ Find root/ payload (optional project templates)
  │   └─ Checksum validation of extracted files
  │
  ├─> Manifest Loader
  │   ├─ Try: load manifest.json from engine
  │   └─ Fallback: synthesize manifest by scanning .claude/ tree
  │
  ├─> Registry Loader
  │   ├─ Try: read ~/.vit/registry.json (previous install state)
  │   └─ Fallback: empty registry (fresh install)
  │
  ├─> Target State Scanner
  │   └─ Checksum-scan .claude/ directory (if exists)
  │
  ├─> Reconciler (PURE LOGIC)
  │   ├─ For each file in manifest:
  │   │  ├─ If new → INSTALL
  │   │  ├─ If checksum matches source → SKIP
  │   │  ├─ If engine changed, user didn't → UPDATE
  │   │  ├─ If user changed, engine didn't → SKIP (unless --force → UPDATE)
  │   │  ├─ If both changed & !--force → CONFLICT
  │   │  └─ If both changed & --force → UPDATE (with warning)
  │   └─ Return ReconcilePlan: array of actions
  │
  ├─> Install Executor
  │   ├─ Create backup of old .claude/ (if exists)
  │   ├─ Apply plan:
  │   │  ├─ Write new/updated files to .claude/
  │   │  ├─ Update registry (.vit/registry.json)
  │   │  └─ Cleanup temp directories
  │   └─ On error: restore from backup
  │
  ├─> Environment Scaffold
  │   └─ Create .claude/.env from .env.example (if missing)
  │
  ├─> Settings Processor
  │   ├─ Load engine settings.json
  │   ├─ Load user settings.json (if exists)
  │   ├─ Merge: engine + user hooks (preserve user-added)
  │   ├─ Prune: zombie hooks (in user.hooks, not in engine)
  │   └─ Write merged settings.json to .claude/
  │
  ├─> Skills Installer (optional)
  │   ├─ Check for install.sh (Linux/macOS) or install.ps1 (Windows)
  │   ├─ Run interactively or auto-install if --yes
  │   ├─ Install Python venv + npm packages for skills
  │   └─ Store install state in .vit/.skill-install-state
  │
  └─> UI Output
      ├─ Print progress spinners during fetch/extract
      ├─ Print success panel: "Cài đặt hoàn tất"
      └─ Print next steps: /vit:plan, /vit:cook, etc
```

## File Reconciliation Architecture

### Registry Format

```json
{
  "version": "1",
  "installedVersion": "1.5.0",
  "files": {
    "claude/rules/CLAUDE.md": {
      "sourceChecksum": "abc123...",
      "targetChecksum": "def456..."
    }
  }
}
```

**Checksums**:
- **sourceChecksum**: SHA-256 of engine file (manifest source)
- **targetChecksum**: SHA-256 of file on disk at last install

### 8-Case Decision Matrix

For each file in manifest:

| Current (disk) | Source Changed? | User Changed? | --force? | Action | Reason |
|---|---|---|---|---|---|
| NULL | — | — | — | **INSTALL** | File doesn't exist on disk |
| = src | no | — | — | **SKIP** | Already up-to-date |
| ≠ src | yes | no | — | **UPDATE** | Engine updated, user didn't edit |
| ≠ src | no | yes | no | **SKIP** | User edited, engine didn't change; preserve user edit |
| ≠ src | no | yes | yes | **UPDATE** | User edited, but --force overrides |
| ≠ src | yes | yes | no | **CONFLICT** | Both changed; needs user decision |
| ≠ src | yes | yes | yes | **UPDATE** | Both changed, but --force overrides |

### Reconciler Implementation

**Location**: `src/reconcile/reconciler.ts`

```typescript
function reconcile(input: ReconcileInput): ReconcilePlan {
  // Returns array of ReconcileAction[]
  // Each action: { type: "install"|"update"|"skip"|"delete", path, area, reason }
}
```

**Key Invariants**:
- Reconciler is **pure** (no I/O, no side effects)
- All I/O (read registry, scan disk, write files) happens in `install-executor.ts`
- Idempotent: same input → same plan, every time
- If reconcile fails, file system untouched (executor validates before writing)

## Multi-Provider Migration Pipeline

### Discovery Phase

**Location**: `src/commands/portable/migrate-discovery.ts`

Scan `.claude/` and catalog all portable items:
- **Agents** (.claude/agents/*.md)
- **Skills** (.claude/skills/* directories)
- **Commands** (.claude/commands/*.md)
- **Rules** (.claude/rules/*.md)
- **Hooks** (.claude/hooks/*.md)
- **Settings** (.claude/settings.json)

### Provider Registry

**Location**: `src/commands/portable/migrate-provider-registry.ts`

Define provider-specific paths, formats, APIs:

```typescript
type ProviderType = "codex" | "opencode" | "antigravity";

interface ProviderConfig {
  paths: ProviderPathConfig;
  format: "copy" | "toml" | "json";
  api?: API interface;
}
```

**Example: Codex**
- Agents → `~/.codex/agents/`
- Skills → `~/.codex/skills/`
- Settings → `~/.codex/config.toml` (frontmatter merge)

### Conversion Phase

**Location**: `src/commands/portable/converters/`

Select converter based on item type + provider:
- **direct-copy**: Copy markdown as-is
- **fm-to-fm**: Frontmatter merge (preserve provider config, add engine items)
- **md-strip**: Remove engine-specific frontmatter (portable format)
- **command-to-codex-skill**: Convert command markdown to Codex skill
- **codex-toml**: Merge into TOML config file

### Installation Phase

**Location**: `src/commands/portable/migrate-installer.ts`

Write converted items to provider:
1. **Dry-run**: Print what would be written (no file I/O)
2. **Real run**: Write files, update registry
3. **Registry tracking**: Record installed items per provider

## Shell Integration (Skill Dependencies)

### Script Selection

```
Platform Detection (isWindows())
  ├─ Windows → .claude/skills/install.ps1 (PowerShell)
  ├─ macOS/Linux → .claude/skills/install.sh (Bash)
```

**Location**: `src/install/skills/script-path-validator.ts`

### Execution

```
executeInteractiveScript(skillsDir, scriptPath)
  ├─ Validate script exists and is readable
  ├─ Set env var: VIT_CLI_ROOT (points to .claude/)
  ├─ Spawn child process with stdio: 'inherit'
  ├─ Capture exit code
  ├─ On error: print error panel with troubleshooting steps
```

**Location**: `src/install/skills/process-executor.ts`

### Error Handling

If `install.sh` / `install.ps1` fails:
- Store error state in `.vit/.skill-install-state`
- Print helpful error panel: what failed, how to fix manually
- Display error display info from error markers in script output

**Location**: `src/install/skills/install-error-display.ts`

## Terminal UI Architecture

### UI Abstraction Layers

```
High-Level Commands (init.ts, doctor.ts, etc)
  │
  └─> printPanel() / intro() / outro()  [ui.ts facade]
       │
       ├─> renderPanel()              [panel.ts]
       ├─> createSpinner()            [spinner.ts]
       ├─> createProgress()           [progress.ts]
       │
       └─> Utilities
            ├─ stripAnsi()            [panel-tokens.ts]
            ├─ wrapText()
            ├─ paint() → colors       [picocolors]
            └─ supportsUnicode()      [ui-capabilities.ts]
```

### Panel Rendering

**Location**: `src/shared/ui/panel.ts`

```typescript
interface PanelOptions {
  title?: string;
  zones: PanelZone[];  // { label, lines }
}

renderPanel(options) // → string[]
```

**Features**:
- Box drawing (Unicode or ASCII fallback)
- Colored titles (--verbose mode)
- Multiple zones (label + content)
- Auto-wrapping text to terminal width

### Spinner & Progress

- **Spinner**: Loading indicator (ora-based, auto-disable in non-TTY)
- **Progress**: Byte counter for downloads (visual feedback)
- Both auto-disable if `!isTTY()` (CI environments)

**Location**: `src/shared/ui/spinner.ts`, `src/shared/ui/progress.ts`

## Environment Detection & CI/CD Handling

### Predicates

**Location**: `src/shared/environment.ts`

```typescript
isWindows()           // → true on Windows
isCIEnvironment()     // → true if CI=true (GitHub Actions, etc)
isNonInteractive()    // → true if !isTTY() or CI
isVerbose()           // → true if --verbose or DEBUG=1
```

### Non-Interactive Mode

When `isNonInteractive()`:
- Skip all prompts
- Auto-select defaults
- Disable spinners/progress (no-op)
- Print structured output for CI parsing

## Error Handling Strategy

### Error Categories

1. **Token Errors** (GitHub auth)
   - No token available → guide user to `gh auth login`
   - Token invalid → check expiry, scopes

2. **Network Errors** (fetch, stream)
   - Transient → retry with exponential backoff (fs-retry.ts)
   - Persistent → suggest proxy/firewall troubleshooting

3. **File Conflicts** (reconciliation)
   - User edit + engine change → show diff, ask user choice
   - --force flag → silently overwrite (with warning in panel)

4. **Skill Install Errors** (script execution)
   - Script not found → guide to manual install
   - Script fails → display error markers from script
   - Retry logic: user can run `vit init --install-skills` again

### Error Display

All errors go through:
1. **logger.error()** — stderr, visible in verbose mode
2. **printPanel()** — user-facing error box with remediation

**Location**: `src/shared/logger.ts`

## State Management

### Registry (`~/.vit/registry.json`)

Tracks installed items:
- Engine version
- File checksums (detect user edits)
- Skill install state (errors, last-run time)

### Backups (`.claude/.vit/backups/`)

Before update, save:
- Previous `.claude/` snapshot
- Previous registry state
- Enable rollback if update fails

### Cache (`~/.vit/cache/`)

Store downloaded tarballs:
- Keyed by version + commit hash
- Auto-cleanup old versions (optional)

## Concurrency & Safety

### File Locking

Not implemented in v1.5.0 (single-user per-project assumption).

**Future consideration** for multi-agent scenarios: use advisory locks (POSIX fcntl on Linux/macOS, OpenFileById on Windows).

### Atomic Operations

- Write to temp file first
- Rename atomic operation (kernel handles)
- Ensures either full success or no change (no partial writes)

## Security Considerations

### Token Handling

- Prefer `gh auth token` (token lives in secure credential store)
- Fallback to `GITHUB_TOKEN` env var (developer's responsibility)
- Never log tokens; mask in verbose output

**Location**: `src/github/token-resolver.ts`

### Path Safety

- All paths resolved via `safeResolve()` (no `..` traversal)
- Validate file paths against manifest before writing
- Prevent symlink attacks (check is-symlink before write)

**Location**: `src/shared/path-safety.ts`

### Dependency Safety

- Verify tarball checksums (SHA-256)
- Validate file structure before extraction
- Isolate skill installs to `.claude/skills/` directory

## Testing Pyramid

```
Unit Tests (50%)
  ├─ reconciler.ts (pure logic)
  ├─ panel-tokens.ts (UI utilities)
  ├─ path-safety.ts
  └─ environment predicates

Integration Tests (40%)
  ├─ install-executor with real files
  ├─ migrate-discovery + converter chain
  └─ settings merge + zombie pruning

E2E Tests (10%)
  ├─ vit init with mock GitHub
  └─ vit migrate with real provider adapters
```

## Unresolved Questions

1. **Web Dashboard** — Optional future feature for config management (would add Express + React)
2. **Gist Templates** — Share plan templates via GitHub Gists (requires GitHub API enhancement)
3. **Multi-workspace** — Support multiple `.claude/` folders per user (currently per-project only)
