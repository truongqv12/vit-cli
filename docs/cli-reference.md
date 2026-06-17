# Vit CLI Reference

Complete reference for all `vit` commands, options, and examples.

## Table of Contents

- [vit init](#vit-init) — Install Vit Engine
- [vit update](#vit-update) — Update Vit Engine
- [vit migrate](#vit-migrate) — Export to other providers
- [vit plan](#vit-plan) — Manage project plans
- [vit doctor](#vit-doctor) — Health check
- [vit version](#vit-version) — Show versions

---

## vit init

Install Vit Engine into `.claude/` of current project.

**Usage**
```bash
vit init [options]
```

**Options**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--token <token>` | string | — | GitHub token (auto-detected if not provided) |
| `--force` | boolean | false | Overwrite user-edited files (use with caution) |
| `--install-skills` | boolean | false | Install skill dependencies immediately (Python venv, npm) |
| `-y, --yes` | boolean | false | Skip all prompts; auto-accept defaults (for CI/CD) |
| `--with-sudo` | boolean | false | Linux: include system packages requiring sudo (ffmpeg, imagemagick) |

**Examples**

```bash
# Interactive install (default)
vit init
# Prompts: GitHub token (if needed), asks to install skill deps

# Auto-install everything (for CI/CD)
vit init -y --install-skills
# Skips all prompts; installs engine + skill deps automatically

# Force overwrite (overrides user edits without asking)
vit init --force
# Caution: will restore engine defaults, losing user modifications

# Provide token explicitly
vit init --token ghp_xxxxxxxxxxx
# Useful in CI with GITHUB_TOKEN secret

# Include system packages (Linux)
vit init --with-sudo
# Installs ffmpeg, imagemagick via apt/brew (may prompt for password)
```

**Exit Codes**

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (invalid token, network, file permission, etc) |

**Behavior**

1. Resolve GitHub token (try: gh, GITHUB_TOKEN env, explicit `--token`, prompt user)
2. Fetch Vit Engine from private GitHub repo (release asset or branch fallback)
3. Extract to temp, scan `.claude/` structure
4. Load manifest + registry (previous install state)
5. Reconcile files:
   - New files → install
   - Engine changed, user didn't → update
   - User changed, engine didn't → preserve user edit
   - Both changed → skip (unless `--force`)
6. Write files to `.claude/`
7. Create `.claude/.env` from template (if missing)
8. Scaffold plan directory (`plans/templates/`)
9. (Optional) Install skill dependencies (ask, or auto-yes with `-y`)
10. Print next steps (slash-commands to use in Claude Code)

**Troubleshooting**

| Issue | Solution |
|-------|----------|
| "No GitHub token" | Run `gh auth login` or set `GITHUB_TOKEN` env var |
| "403 Forbidden" | Check GitHub token has `repo` scope; you have access to engine repo |
| "Network timeout" | Retry; check firewall/proxy settings |
| "File permission denied" | Check `.claude/` writable; run with elevated perms if needed |
| Skill install failed | See error panel; run `vit init --install-skills` to retry |

---

## vit update

Update Vit Engine to latest version while preserving user customizations.

**Usage**
```bash
vit update [options]
```

**Options**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--token <token>` | string | — | GitHub token |
| `--force` | boolean | false | Overwrite user edits; restore engine defaults |
| `--dry-run` | boolean | false | Preview changes without writing files |
| `--install-skills` | boolean | false | Update skill dependencies |
| `-y, --yes` | boolean | false | Skip confirmation prompts |
| `--with-sudo` | boolean | false | Linux: include system packages |

**Examples**

```bash
# Preview update (recommended first step)
vit update --dry-run
# Shows: which files will be updated/skipped, file counts

# Apply update (safe: preserves user edits)
vit update
# Updates engine, keeps your custom rules/hooks

# Force update (WARNING: overwrites your edits)
vit update --force
# Restores engine defaults; creates backup of old .claude/

# Update with new skill deps
vit update --install-skills
# Upgrades engine + re-runs install.sh / install.ps1

# CI/CD non-interactive
vit update -y --install-skills
# Skips prompts; suitable for automated pipelines
```

**Exit Codes**

| Code | Meaning |
|------|---------|
| 0 | Success (updated or no changes) |
| 1 | Error (conflict, permission, network) |

**Behavior**

Same as `vit init`, but:
1. Load previous registry (know which files were user-edited vs engine)
2. Detect changes:
   - Engine version bumped? → check release notes
   - Files added/removed? → apply deletions manifest
3. Reconcile:
   - New files in this version → install
   - You edited, engine didn't change → keep yours
   - Engine changed, you didn't edit → update
   - Both changed & `--force` → restore engine version
4. Backup old `.claude/` (for rollback if needed)
5. Merge settings.json (preserve your hooks, strip orphaned hooks)

**Dry-Run Output**

```
Reconcile Plan
─────────────────────
  Install:   3 files
  Update:    5 files
  Skip:      12 files (user-edited, preserved)
  Total:     20 files

Notable Changes
─────────────────────
  - New hook: event-logger (trigger: on_command_run)
  - Removed skill: old-deprecated-skill
  - Updated: CLAUDE.md (engine core rules)
```

**Troubleshooting**

| Issue | Solution |
|-------|----------|
| "Conflicts detected" | Run `vit update --force` to override, or keep your version (CLI will skip) |
| "Update failed, rolled back" | Check logs; previous `.claude/` restored from backup in `.vit/backups/` |

---

## vit migrate

Export `.claude/` (agents, skills, commands, rules) to external provider platforms (Codex, OpenCode, Antigravity).

**Usage**
```bash
vit migrate [options]
```

**Options**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-a, --agent <provider>` | string[] | — | Target provider(s): `codex`, `opencode`, `antigravity` (repeatable) |
| `--all` | boolean | false | Migrate to all 3 providers |
| `--providers <list>` | string | — | Alias for `--agent`; comma-separated list |
| `-g, --global` | boolean | false | Migrate from `~/.claude/` (global) instead of `./.claude/` (project) |
| `-f, --force` | boolean | false | Reinstall even if no changes detected; create backups |
| `-y, --yes` | boolean | false | Skip confirmation prompts |
| `--dry-run` | boolean | false | Preview conversions without writing |
| `--only-agents` | boolean | false | Migrate only agents |
| `--only-commands` | boolean | false | Migrate only commands |
| `--only-skills` | boolean | false | Migrate only skills |
| `--config` | boolean | false | Migrate only CLAUDE.md config |
| `--rules` | boolean | false | Migrate only rules |
| `--hooks` | boolean | false | Migrate only hooks |
| `--skip-agents` | boolean | false | Skip agents (migrate everything else) |
| `--skip-commands` | boolean | false | Skip commands |
| `--skip-skills` | boolean | false | Skip skills |
| `--skip-config` | boolean | false | Skip config |
| `--skip-rules` | boolean | false | Skip rules |
| `--skip-hooks` | boolean | false | Skip hooks |
| `--source <path>` | string | — | Custom CLAUDE.md path (config-only migration) |
| `--reinstall-empty-dirs` | boolean | true | Reinstall items when their directory is empty |
| `--respect-deletions` | boolean | false | Preserve items user deleted (disable reinstall) |

**Examples**

```bash
# Preview migration (recommended first)
vit migrate --agent codex --dry-run
# Shows: what will be copied/converted to Codex

# Migrate to one provider
vit migrate --agent codex
# Copies agents, skills, commands, rules, hooks to ~/.codex/

# Migrate to multiple providers
vit migrate --agent codex -a opencode
# OR: vit migrate --providers codex,opencode
# Exports to both Codex and OpenCode

# Migrate to all providers
vit migrate --all
# Exports to codex, opencode, antigravity

# Selective migration (only rules + hooks)
vit migrate --agent codex --rules --hooks
# Skips agents, commands, skills

# Global migration (from ~/.claude/ instead of ./.claude/)
vit migrate --global --agent opencode
# Useful for system-wide engine copy

# Force reinstall (recreate even if unchanged)
vit migrate --force --agent codex
# Backups previous provider config, reinstalls all items

# CI/CD non-interactive
vit migrate --all -y --dry-run
# Preview without prompt (then decide to run without --dry-run)
```

**Exit Codes**

| Code | Meaning |
|------|---------|
| 0 | Success (migrated or no changes) |
| 1 | Error (invalid provider, no .claude/ found, etc) |

**Provider Details**

### Codex
- **Path**: `~/.codex/`
- **Format**: Markdown + TOML config
- **Supported Items**: Agents, skills, commands, rules, hooks, settings
- **Notes**: Full feature support; hooks are preserved

### OpenCode
- **Path**: `~/.opencode/`
- **Format**: JSON structure
- **Supported Items**: Agents, skills, commands, rules (no hooks)
- **Notes**: Hooks not supported on this platform

### Antigravity
- **Path**: `~/.antigravity/config/`
- **Format**: Markdown + JSON
- **Supported Items**: Core items (agents, skills)
- **Notes**: Limited feature set compared to Codex

**Behavior**

1. Validate option combinations (e.g., `--only-agents` + `--skip-agents` = error)
2. Discover items from `.claude/` (or `~/.claude/` if `--global`):
   - Agents (`.claude/agents/*.md`)
   - Skills (`.claude/skills/` directories)
   - Commands (`.claude/commands/*.md`)
   - Rules (`.claude/rules/*.md`)
   - Hooks (`.claude/hooks/*.md`)
   - Settings (`.claude/settings.json`)
3. For each provider:
   - Select converter (direct-copy, Markdown merge, TOML, etc)
   - Convert items to provider format
   - Dry-run: print what would be written
   - Real run: write files to provider path, update provider registry
4. Print summary: installed/skipped/converted counts

**Troubleshooting**

| Issue | Solution |
|-------|----------|
| "Provider path not found" | Provider not installed; `vit migrate --dry-run` first to verify |
| "Hooks not supported" | OpenCode/Antigravity don't support hooks; use `--skip-hooks` |
| "Generated-context hooks filtered out" | Claude-specific hooks (session-init, etc) are non-portable; expected behavior |

---

## vit plan

Manage project plans: create, check/uncheck phases, view status.

**Usage**
```bash
vit plan <action> [target] [options]
```

**Actions**

| Action | Description |
|--------|-------------|
| `create` | Create new plan directory with phases |
| `check` | Mark phase as done (or in-progress with `--start`) |
| `uncheck` | Mark phase as not done |
| `status` | Print plan progress |

**Options for `create`**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--title <title>` | string | "Untitled Plan" | Plan name |
| `--phases <phases>` | string | — | Comma-separated phase names |
| `--dir <slug>` | string | auto | Directory slug (auto-generated from title) |

**Options for `check` / `uncheck`**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--start` | boolean | false | Mark as "in progress" instead of "done" |

**Examples**

```bash
# Create plan with phases
vit plan create --title "Add Authentication" --phases "Research, API, UI, Testing"
# Creates: plans/YYYYMMDD-HHMM-add-authentication/
#   ├── plan.md
#   ├── 01-research.md
#   ├── 02-api.md
#   ├── 03-ui.md
#   └── 04-testing.md

# Check phase (mark done)
cd plans/YYYYMMDD-HHMM-add-authentication/
vit plan check 1
# Marks phase 1 as done

# Check phase (mark in progress)
vit plan check 2 --start
# Marks phase 2 as currently being worked on

# Uncheck phase
vit plan uncheck 1
# Marks phase 1 as not done (back to TODO)

# Show progress
vit plan status
# Prints: Phase 1/4 done, Phase 2 in progress, Phase 3-4 TODO

# Auto-detect plan from current directory
cd plans/YYYYMMDD-HHMM-add-authentication/
vit plan status
# If inside a plan folder, no target needed
```

**Plan Directory Structure**

```
plans/
└── 20250618-1430-add-authentication/
    ├── plan.md              # Overview (created by CLI)
    ├── 01-research.md       # Phase 1
    ├── 02-api.md            # Phase 2
    ├── 03-ui.md             # Phase 3
    └── 04-testing.md        # Phase 4
```

**plan.md Template** (auto-generated)

```markdown
# Add Authentication

**Created**: 2025-06-18
**Phases**: 4
**Status**: Phase 1/4 done, Phase 2 in progress

## Phases

- [x] 1. Research
- [•] 2. API (in progress)
- [ ] 3. UI
- [ ] 4. Testing

## Next Steps

Work on phase 2 (API). Run `vit plan check 2` when done.
```

**Exit Codes**

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (invalid phase number, plan not found, etc) |

---

## vit doctor

Run health checks on Vit Engine installation and environment.

**Usage**
```bash
vit doctor
```

**Checks**

1. **GitHub Token** — Verify `gh auth token` works and has `repo` scope
2. **Engine Access** — Can read private engine repo
3. **.claude/ Structure** — `.claude/` exists and contains expected directories
4. **Hook Wiring** — Hooks in `.claude/hooks/` match entries in `settings.json`
5. **Skills State** — Check Python venv + npm packages installed (if applicable)

**Output**

```
Health Check Results
────────────────────────────────────

✓ GitHub Token: Valid (scope: repo)
✓ Engine Access: Can read truongqv12/vit-engine
✓ .claude/ Structure: Valid (52 files)
⚠ Hook Wiring: 1 orphaned hook detected (remove-stale-hook)
⚠ Skills: Python venv not initialized (run: vit init --install-skills)

Recommendations
────────────────────────────────────

1. Prune orphaned hook:
   rm .claude/hooks/remove-stale-hook.md

2. Install skill dependencies:
   vit init --install-skills
```

**Exit Codes**

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | One or more checks failed |

**Troubleshooting**

| Issue | Solution |
|-------|----------|
| "Invalid GitHub token" | Run `gh auth login` to update credentials |
| "No permission to read engine" | Check you're invited to the private repo |
| ".claude/ not found" | Run `vit init` to install engine first |
| "Orphaned hooks detected" | Run `vit update` to reconcile settings.json |

---

## vit version

Print Vit CLI version and installed Vit Engine version.

**Usage**
```bash
vit version
```

**Output**

```
Vit CLI
───────────────────
  Version:  1.5.0
  Binary:   /usr/local/bin/vit
  Node:     18.19.0

Vit Engine (installed)
───────────────────
  Version:  main (branch)
  Path:     .claude/
  Synced:   2025-06-18 10:30:00 UTC

Latest on npm
───────────────────
  Version:  1.5.0
  Status:   You're up to date!
```

**Exit Codes**

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (registry corrupted, etc) |

---

## Global Options

All commands support:

| Flag | Description |
|------|-------------|
| `--help` | Show command help |
| `--verbose` | Enable debug logging |

**Examples**

```bash
vit init --help
vit init --verbose
# Print detailed debug info during install
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub personal access token (for private repo access) |
| `CI` | Set to `true` in CI environments (disables TTY prompts) |
| `DEBUG` | Set to `vit:*` for verbose debug output |
| `VIT_CACHE_DIR` | Override default cache directory (`~/.vit/cache/`) |

**Example**

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxx
export DEBUG=vit:*
vit init
```

---

## Common Workflows

### First-Time Setup (Developer)
```bash
gh auth login                      # One-time GitHub auth
cd my-project/
vit init                          # Install engine interactively
# Follow prompts; optionally install skill deps
# Open Claude Code → use /vit:plan, /vit:cook, etc
```

### Scheduled Update
```bash
vit update --dry-run              # Preview changes
vit update                        # Apply update
vit doctor                        # Verify health
```

### CI/CD Pipeline
```bash
vit init -y --install-skills      # Auto-install everything
# (GITHUB_TOKEN env var must be set before this step)
# Now Claude Code commands available in CI job
```

### Export to External Platform
```bash
vit migrate --dry-run --agent opencode
# Review what will be copied
vit migrate --agent opencode
# Now use engine in OpenCode provider
```

---

## Getting Help

```bash
vit --help                        # Show all commands
vit init --help                   # Show init command help
vit doctor                        # Run health check
```

If you encounter issues:
1. Run `vit doctor` to diagnose
2. Check error message for remediation steps
3. Run with `--verbose` for debug logs
4. Refer to troubleshooting sections above
