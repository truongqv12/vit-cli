# Code Standards — Vit CLI

## Overview

Vit CLI follows **modular domain-driven design** with TypeScript strict mode. Code is organized for clarity, maintainability, and testability. All standards are enforced via automated linting and pre-commit hooks.

## Language & Build

### TypeScript Configuration

- **Version**: 5.7.2 (strict mode enabled)
- **Module**: ES modules (import/export)
- **Target**: ES2020 (Node.js 18+)
- **Strict Options**: All enabled (`strict: true`, `noImplicitAny`, `strictNullChecks`, etc)
- **Compiled Output**: `dist/` (git-ignored)

```bash
npm run build       # tsc -p tsconfig.json
npm run typecheck   # tsc --noEmit
```

### CommonJS vs ESM

- **Source**: Always ES modules (`import`/`export`)
- **Binary**: `bin/vit.js` wraps compiled `dist/index.js`
- **package.json**: `"type": "module"` enables ESM by default

## File Organization

### Module Structure

```
src/
├── {domain}/
│   ├── index.ts              # Facade (re-exports public API)
│   ├── {module-name}.ts      # Core logic module
│   ├── {module-name}.test.ts # Unit tests (or __tests__/)
│   └── {subdir}/             # Logical grouping
│       └── {sub-module}.ts
```

### File Naming Convention

| Type | Convention | Example |
|------|-----------|---------|
| **Source files** | kebab-case | `engine-fetcher.ts`, `settings-merger.ts` |
| **Test files** | Same name + `.test.ts` or in `__tests__/` | `reconciler.test.ts` |
| **Interfaces** | PascalCase | `ReconcileAction`, `FetchEngineOptions` |
| **Functions** | camelCase | `reconcile()`, `extractTarball()` |
| **Constants** | UPPER_SNAKE_CASE | `ENGINE_REPO`, `RUNTIME_DIR` |
| **Enums** | PascalCase values | `enum CliMode { INTERACTIVE, CI }` |
| **Folders** | kebab-case | `src/github/`, `src/shared/ui/` |

### Self-Documenting Names

File names must describe purpose without reading content. LLM tools (Grep, Glob) should understand intent from name alone.

**Good**:
- `engine-fetcher.ts` — obviously fetches engine
- `settings-merger.ts` — merges settings
- `zombie-hook-pruner.ts` — removes unused hooks
- `token-resolver.ts` — resolves auth token

**Bad**:
- `fetch.ts` — too generic
- `merge.ts` — ambiguous
- `cleaner.ts` — vague
- `auth.ts` — no indication of token resolution

## Module Size Limits

### Hard Limits

| File Type | Max LOC | Reason |
|-----------|---------|--------|
| **Source module** | 200 | Keep cognitive load low; easier to test, understand, review |
| **Facade** | 150 | Re-export public API only; keep light |
| **Test file** | No hard limit | Tests can be longer; organize by test suite |

### Exceeding Limits

If a file approaches 200 LOC:
1. **Identify logical boundaries** — split by concern (e.g., parsing vs rendering)
2. **Create submodules** — move logic to focused modules
3. **Update facade** — re-export from submodules
4. **No external impact** — imports remain the same (facade hides structure)

**Example**: `install-engine.ts` (60 LOC) calls `installEngine()` which delegates to:
- `fetchEngine()` from `github/engine-fetcher.ts`
- `loadOrSynthesizeManifest()` from `reconcile/engine-manifest.ts`
- `executeInstall()` from `install/install-executor.ts`

## Coding Style

### TypeScript & JavaScript

#### Imports & Exports

**Use named exports** (except rare singleton patterns):

```typescript
// ✅ Good
export function reconcile(input: ReconcileInput): ReconcilePlan { }
export interface ReconcileInput { }

// ❌ Avoid default exports
export default function reconcile() { }
```

**Organize imports by type**:
```typescript
// Standard library
import path from "node:path";
import fs from "fs-extra";

// External deps
import { Octokit } from "@octokit/rest";
import { cac } from "cac";

// Internal: relative paths, sorted
import { reconcile } from "../reconcile/reconciler.js";
import { log } from "../shared/logger.js";
```

#### Naming

```typescript
// ✅ Clear, explicit
const sourceChecksum = calculateChecksum(engineFile);
const userEdited = currentChecksum !== previousChecksum;
const shouldUpdate = engineChanged && !userEdited && !force;

// ❌ Cryptic abbreviations
const src = calc(f);
const ud = cur !== prev;
const su = ec && !ue && !f;
```

#### Type Annotations

Always annotate function signatures:

```typescript
// ✅ Good
export function reconcile(input: ReconcileInput): ReconcilePlan {
  const actions: ReconcileAction[] = [];
  for (const file of input.manifest.files) {
    // ...
  }
  return { actions, summary: { total: actions.length } };
}

// ❌ Avoid implicit any
function reconcile(input) {
  const actions = [];  // any[]
}
```

#### Error Handling

Always use try-catch for external I/O:

```typescript
// ✅ Good
try {
  const token = resolveToken(options.token);
  await fetchEngine({ token });
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  log.error(`GitHub access failed: ${msg}`);
  throw new Error(`Cannot fetch engine: ${msg}`);
}

// ❌ Avoid bare throws without context
try {
  await fetchEngine();
} catch (err) {
  throw err;  // loses context
}
```

### Comments & Documentation

#### Inline Comments

Use comments **only for non-obvious logic**. Names should be self-documenting.

```typescript
// ✅ Good: explains why, not what
// Checksum mismatch + engine changed = user edited file. Skip unless --force.
if (userModified && !engineChanged) {
  actions.push({ type: "skip", reason: "user edit preserved" });
}

// ❌ Bad: comment repeats code
// Set userModified to true if cur !== reg.targetChecksum
const userModified = cur !== reg.targetChecksum;
```

#### JSDoc

Use JSDoc for **public functions & interfaces**:

```typescript
/**
 * Reconcile manifest against current filesystem state.
 * Uses checksums to detect user edits vs engine changes.
 *
 * @param input - Manifest, registry, and target state
 * @returns Plan of actions (install/update/skip per file)
 * @throws Error if manifest invalid or registry corrupted
 */
export function reconcile(input: ReconcileInput): ReconcilePlan {
  // ...
}
```

#### Avoid

- **TODO/FIXME comments in code** — raise issues instead, or document in PDR
- **Commented-out code** — delete it; version control has history
- **Over-documentation** — let types and names speak

### Async & Promises

```typescript
// ✅ Use async/await (clearer than .then())
async function installEngine(options: InstallEngineOptions): Promise<void> {
  const token = resolveToken(options.token);
  const { engineDir } = await fetchEngine({ token });
  const manifest = await loadOrSynthesizeManifest(engineDir);
  // ...
}

// ❌ Callback hell
fetchEngine(token).then(({ engineDir }) => {
  loadOrSynthesizeManifest(engineDir).then(manifest => {
    // ...
  });
});
```

### Null & Undefined Handling

```typescript
// ✅ Use type guards & optional chaining
const version = registry?.installedVersion ?? "unknown";

// ✅ Explicit null checks
if (targetState[key] === null) {
  actions.push({ type: "install" });
}

// ❌ Loose equality (== vs ===)
if (value == null) {  // Finds both null and undefined; confusing
}
```

## Testing Standards

### Test File Location

```
src/
├── commands/
│   ├── doctor.ts
│   ├── doctor.test.ts          # or __tests__/doctor.test.ts
│   └── doctor-health-checks.ts
```

### Test Structure

```typescript
import { describe, it, expect } from "bun:test";  // or Node test runner
import { reconcile } from "../reconcile/reconciler.js";

describe("reconcile()", () => {
  it("installs files not present on disk", () => {
    const result = reconcile({
      manifest: { files: [{ path: "new.md", checksum: "abc", area: "claude" }] },
      registry: null,
      targetState: {},
      deletions: [],
      force: false,
    });

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe("install");
  });

  it("skips files user has edited (unless --force)", () => {
    // Arrange
    const input = { /* ... */ };

    // Act
    const result = reconcile(input);

    // Assert
    expect(result.actions[0].type).toBe("skip");
  });
});
```

### Test Naming

```typescript
// ✅ Clear, action-focused
it("preserves user-edited files on update")
it("throws error if GitHub token invalid")
it("falls back to branch tarball if release not found")

// ❌ Vague
it("works correctly")
it("does reconciliation")
it("tests token")
```

### Unit vs Integration

- **Unit tests** — pure functions (reconciler, path-safety, checksum) with mock data
- **Integration tests** — real file I/O (reconcile + install executor together)
- **E2E tests** — full CLI with mock GitHub API

### No Real GitHub Calls in Tests

**Always mock** Octokit API:

```typescript
import * as sinon from "sinon";

it("fetches engine on valid token", async () => {
  const stub = sinon.stub(Octokit.prototype, "repos.get").resolves({
    owner: "truongqv12",
    repo: "vit-engine",
  });

  // Test code
  expect(stub.called).toBe(true);

  stub.restore();
});
```

## Error Handling & Logging

### Error Messages

**Write errors for users, not developers**:

```typescript
// ✅ User-friendly
throw new Error(
  "Cannot access engine private repo. Check GitHub token: " +
  "Run `gh auth login` or set GITHUB_TOKEN environment variable."
);

// ❌ Developer-focused jargon
throw new Error("Octokit 403: repos.get() failed");
```

### Logging Levels

```typescript
import { log } from "../shared/logger.js";

log.debug("Starting fetch from branch: main");     // Verbose mode only
log.info("Extracting engine files...");             // Normal output
log.warn("Found user-edited file; preserving");     // Non-blocking issue
log.error("Failed to write .claude/: EACCES");      // Blocking error
```

### Verbose Mode

Enable with `--verbose` or `DEBUG=vit:*`:

```typescript
if (isVerbose()) {
  log.debug(`Reconcile plan: ${JSON.stringify(plan)}`);
}
```

## Path & File Safety

### Always Use Path Module

```typescript
// ✅ Safe
import path from "node:path";
const claudeDir = path.join(projectRoot, ".claude");
const envFile = path.join(claudeDir, ".env");

// ❌ String concatenation (breaks on Windows)
const envFile = `${claudeDir}/.env`;

// ❌ Template literals
const envFile = `${claudeDir}\\.env`;  // Wrong separator
```

### Validate Paths

```typescript
import { safeResolve, hasDotDotSegment } from "../shared/path-safety.js";

// Prevent directory traversal attacks
const filePath = safeResolve(claudeDir, userInput);
if (hasDotDotSegment(filePath)) {
  throw new Error("Invalid path: contains directory traversal");
}
```

## Configuration & Constants

### Static Config

```typescript
// src/shared/config.ts
export const ENGINE_REPO = {
  owner: "truongqv12",
  repo: "vit-engine",
  branch: "main",
} as const;

export const RUNTIME_DIR = ".claude";
export const VIT_STATE_DIR = path.join(RUNTIME_DIR, ".vit");
```

### Environment Variables

```typescript
// src/shared/environment.ts
export function isCIEnvironment(): boolean {
  return process.env.CI === "true" ||
         process.env.GITHUB_ACTIONS === "true" ||
         process.env.GITLAB_CI === "true";
}
```

### No Magic Strings

```typescript
// ✅ Named constant
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
  await sleep(RETRY_DELAY_MS);
}

// ❌ Magic numbers
for (let attempt = 0; attempt < 3; attempt++) {
  await sleep(1000);
}
```

## Security Best Practices

### Token Handling

```typescript
// ✅ Use credential store (gh token)
const token = execSync("gh auth token", { encoding: "utf-8" }).trim();

// ✅ Mask token in logs
const maskedToken = token.slice(0, 4) + "****";
log.debug(`Using token: ${maskedToken}`);

// ❌ Log full token
log.debug(`Token: ${token}`);
```

### File Validation

```typescript
// ✅ Validate structure before extraction
const { engineDir, rootDir } = await extractTarball(buffer);
if (!fs.existsSync(path.join(engineDir, "hooks"))) {
  throw new Error("Invalid engine tarball: missing hooks directory");
}

// ❌ Trust extracted structure blindly
await extractTarball(buffer);
```

## Dependency Management

### Adding Dependencies

**Approved** (low risk, actively maintained):
- `@octokit/rest` — GitHub API
- `@clack/prompts` — CLI prompts
- `cac` — Argument parsing
- `tar`, `fs-extra` — File operations
- `picocolors` — Terminal colors

**NOT approved** (bloat, outdated, security):
- Heavy frameworks (Express, NextJS for CLI)
- Deprecated packages
- Packages with many transitive deps

### Peer Dependencies

None specified (all direct deps bundled).

## Git & Commits

### Commit Message Format

Follow Conventional Commits:

```
feat: add vit migrate command
fix: reconciler skips unchanged files correctly
docs: update codebase-summary.md
test: add reconcile() unit tests
chore: bump typescript to 5.7.2
```

**Types**: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`

### Pre-Commit Hooks

Automatic linting + type check before commit:

```bash
npm run lint:fix   # Biome auto-fix
npm run typecheck  # tsc --noEmit
npm test           # Run tests
```

### Code Review Checklist

Before pushing:
- [ ] `npm run typecheck` passes
- [ ] `npm run lint:fix` passes
- [ ] `npm test` passes
- [ ] New public APIs have JSDoc
- [ ] Error messages are user-friendly
- [ ] No hardcoded secrets
- [ ] Paths use `path.join()`, not string concat

## Performance Considerations

### Stream-Based Downloads

For large files, use streams to avoid buffering entire content:

```typescript
// ✅ Stream (memory efficient)
const stream = fs.createReadStream(filePath);
archive.pipe(stream);

// ❌ Buffer (high memory)
const buffer = fs.readFileSync(filePath);
```

### Lazy Loading

Import heavy modules only when needed:

```typescript
// ✅ Lazy import in function
async function fetchEngine() {
  const { Octokit } = await import("@octokit/rest");
  // ...
}

// ❌ Top-level import for rarely-used module
import Octokit from "@octokit/rest";
```

### Concurrency

For parallel operations (skill install), use Promise.all():

```typescript
// ✅ Parallel
await Promise.all([
  installPythonVenv(skillsDir),
  installNpmPackages(skillsDir),
]);

// ❌ Sequential
await installPythonVenv(skillsDir);
await installNpmPackages(skillsDir);
```

## Documentation Requirements

### New Features

Every new feature requires:
1. **Code** — Source files + tests
2. **API docs** — JSDoc comments
3. **User guide** — `docs/cli-reference.md` updated
4. **Architecture** — `docs/system-architecture.md` if major changes
5. **Changelog** — Note in commit message (auto-added by semantic-release)

### Breaking Changes

If API or CLI command changes:
1. Document migration path
2. Deprecate old usage first (if possible)
3. Update all code examples in docs
4. Note in `docs/project-overview-pdr.md` under "Non-Functional Requirements" → breaking changes section

## Unresolved Questions

None. Standards stable as of v1.5.0. Any future additions (Web UI, Gist templates) will expand applicable sections.
