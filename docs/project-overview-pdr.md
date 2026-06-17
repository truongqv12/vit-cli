# Vit CLI — Project Overview & PDR

## Project Identity

**Project Name**: Vit CLI

**Version**: 1.5.0

**Repository**: https://github.com/truongqv12/vit-cli

**NPM Package**: @truongqv12/vit-cli

**License**: MIT

**Architecture**: Modular domain-driven CLI with fetch engine + reconciliation + skill installer

**Codebase**: TypeScript (strict mode), 50+ source files, semantic-release automation

## Core Mission

**Vit CLI is the installer and lifecycle manager for Vit Engine** — a unified set of AI-powered development rules, skills, and agents for Claude Code. It streamlines the setup, update, and migration of Vit Engine across projects and external AI provider platforms (Codex, OpenCode, Antigravity).

### Two Imperatives

1. **Ease Installation** — `vit init` should cài Vit Engine into `.claude/` with minimal friction, handling authentication, reconciliation, and optional skill deps automatically.
2. **Enable Evolution** — `vit update` merges new engine versions while preserving user customizations (custom rules, hooks, config). `vit migrate` exports engine to other providers.

### Design Philosophy

- **Safety First**: Reconcile with checksums; preserve user-edited files unless `--force` is set
- **Non-Interactive Ready**: All commands support `-y/--yes` for CI/CD pipelines; heuristics for non-TTY environments
- **Transparent State**: Registry (`~/.vit/registry.json`) + manifest track what's installed, enabling idempotent operations
- **Cross-Platform**: Works on Windows (PowerShell), macOS, Linux; shell scripts auto-selected per OS

## Executive Summary

Vit CLI (`vit`) is a command-line tool for developers to install, maintain, and evolve Vit Engine — a private GitHub repository containing standardized AI development patterns for Claude Code. Designed as per-project setup (`vit init`) with optional global migration (`vit migrate --global`), it provides:

- **Private Repo Access**: Secure token handling (gh token fallback, `GITHUB_TOKEN` env, explicit `--token` flag)
- **Tarball Fetching**: Stream-based download from GitHub releases or branch fallback
- **File Reconciliation**: Checksum-based conflict detection; preserves user edits, merges engine updates
- **Manifest Versioning**: Portable manifest system for tracking engine version and deletions across releases
- **Skill Dependencies**: Optional installation of Python venv + npm packages for AI skills
- **Multi-Provider Export**: Migrate installed engine to Codex, OpenCode, Antigravity provider formats
- **Plan Scaffolding**: Create timestamped, phase-based project plans with CLI support

## Target Users

### Primary Users
1. **Developers using Claude Code** — Need Vit Engine to unlock slash-commands (`/vit:plan`, `/vit:cook`, `/vit:fix`)
2. **AI Teams** — Building projects with multi-agent workflows, custom skills, hooks
3. **CI/CD Engineers** — Automating per-project engine setup in build pipelines
4. **Indie Developers & Startups** — Rapid prototyping with pre-configured AI rules and agents

### User Personas

#### Persona 1: Full-Stack Developer
- **Needs**: One-command setup, no surprises, keep personal rules intact
- **Pain Points**: Manual engine configuration, update conflicts
- **Goals**: `vit init` → use `/vit:plan` immediately in Claude Code

#### Persona 2: DevOps Engineer
- **Needs**: Non-interactive CI/CD setup, validation (doctor), skill deps auto-installed
- **Pain Points**: Manual dependency management, inconsistent environments
- **Goals**: `vit init -y --install-skills` in GitHub Actions; repeatable, idempotent

#### Persona 3: Researcher / Multi-Provider User
- **Needs**: Export engine to Codex/OpenCode for external experiments
- **Pain Points**: Manual config replication across platforms
- **Goals**: `vit migrate --agent opencode --dry-run` → inspect → `vit migrate --agent opencode` → push

## Core Features

### 1. Engine Installation (`vit init`)

**Functional Requirements**
- Download Vit Engine from private GitHub repo (releases or branch)
- Extract into `.claude/` (per-project runtime)
- Create/scaffold `.claude/.env` from `.env.example`
- Reconcile files: preserve user edits, overwrite engine files on update (unless user-modified)
- Optionally install skill dependencies (Python venv, npm packages)
- Warn on new CLI version available (non-blocking)

**Non-Functional Requirements**
- Response time: <10s for fresh install (depends on network)
- Graceful error handling with actionable messages
- Works in both interactive (TTY) and non-interactive (CI) modes
- Fallback prompt behavior when `--yes` or CI-detected

### 2. Engine Update (`vit update`)

**Functional Requirements**
- Fetch latest engine version
- Dry-run preview with `--dry-run` (show file actions without writing)
- Merge settings.json: preserve user-added hooks, strip zombie hooks
- Reconciliation: skip user-modified files (unless `--force`), update unchanged engine files
- Reinstall skill deps if flag set

**Non-Functional Requirements**
- Atomic operation: either fully complete or rollback (via backup + registry)
- No data loss: backup old `.claude/` before overwriting

### 3. Health Checks (`vit doctor`)

**Functional Requirements**
- Verify GitHub token validity (can read engine repo)
- Check `.claude/` structure exists and is valid
- Scan hook wiring (`.claude/hooks/` matches `settings.json`)
- Validate skill state (presence of `.venv/`, npm node_modules)
- Report missing dependencies

**Non-Functional Requirements**
- Clear, actionable remediation steps in output

### 4. Multi-Provider Migration (`vit migrate`)

**Functional Requirements**
- Discover agents, skills, commands, rules, hooks, settings from `.claude/`
- Convert to provider-specific formats (Codex TOML, OpenCode JSON, Antigravity config)
- Dry-run preview (`--dry-run`)
- Install to provider (via provider-specific APIs or file operations)
- Support multiple providers in one call (`--agent codex -a opencode`)

**Non-Functional Requirements**
- Non-destructive by default (preserve provider configs unless `--force`)
- Skip generated-context hooks (Claude-specific, not portable)

### 5. Project Planning (`vit plan`)

**Functional Requirements**
- Create timestamped plan directory with phase structure
- Check/uncheck phases to track progress
- Print plan status (current phase, completed phases)
- Plan can be used by agent to coordinate work

**Non-Functional Requirements**
- Lightweight, file-based (no database dependency)

### 6. Version Management (`vit version`)

**Functional Requirements**
- Print current CLI version
- Print installed Vit Engine version (read from registry)
- Show next available version (if update available)

## Success Criteria

| Criterion | Metric |
|-----------|--------|
| **Installation Success** | 95% of first-time users complete `vit init` without manual intervention |
| **Update Safety** | 0 data loss on update; user edits preserved; reconciliation conflict detection works |
| **Doctor Reliability** | `vit doctor` catches all common setup issues (missing token, corrupted .claude/, broken hooks) |
| **Migration Confidence** | Users can `vit migrate --dry-run` without risk; conversion produces valid provider configs |
| **CI/CD Adoption** | `vit init -y --install-skills` completes in <2m in typical CI environment |

## Non-Functional Requirements

### Reliability
- Token refresh retry logic (transient network errors)
- Checksum validation on extracted files
- Atomic file operations (write to temp, then rename)

### Performance
- Streaming downloads with progress bars (visual feedback for slow networks)
- Parallel skill dependency installation when safe
- Cache strategy for tarball downloads (`~/.vit/cache/`)

### Security
- Token validation before GitHub API calls
- No hardcoded secrets; environment variables or secure prompts only
- Path safety: no `..` traversal in file operations
- Warn on private repo permissions requirements

### Developer Experience
- Clear error messages (not stack traces unless `--verbose`)
- Progress spinners/bars for long-running operations
- Dry-run mode for destructive operations
- One-command activation (`vit init`) in fresh project

## Product Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Done | Core CLI framework + `init` command |
| 2 | ✅ Done | GitHub private repo access + token resolution |
| 3 | ✅ Done | File reconciliation with checksums + manifest |
| 4 | ✅ Done | `plan` subcommand for project scaffolding |
| 5 | ✅ Done | Skill dependency installation (`install.sh`/`install.ps1`) |
| 6 | ✅ Done | Full engine migration (89 skills, 13 agents, 129 hooks) |
| 7 | ✅ Done | Multi-provider migrate (`codex`, `opencode`, `antigravity`) |
| 8 | ✅ Done | Settings merge + zombie hook pruning |
| 9 | ✅ Done | Doctor health checks + audit trail |
| 10 | Future | Web UI dashboard for config management (optional) |
| 11 | Future | GitHub Gists sync for shareable plan templates |

## Constraints & Dependencies

### External Dependencies
- **GitHub API** — Private repo access (engine-fetcher.ts uses Octokit)
- **GitHub CLI** (`gh`) — Token management via `gh auth login`
- **Node.js** ≥18 — Runtime requirement
- **tar**, **fs-extra** — Archive extraction, file I/O
- **semantic-release** — Automated versioning on release

### File System Constraints
- `.claude/` directory: per-project, ~50MB (engine + skills)
- `~/.vit/cache/` — global cache for tarballs, auto-cleanup
- `~/.vit/registry.json` — installed version metadata

### Compatibility
- **Windows**: PowerShell, Git Bash, or WSL shell
- **macOS**: Bash or Zsh
- **Linux**: Bash or Zsh
- No breaking changes on Node.js LTS versions within major.minor release

## Unresolved Questions

None at this stage. Architecture and feature set stable as of v1.5.0.
