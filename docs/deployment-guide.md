# Deployment Guide — Vit CLI

## Overview

This guide covers building, testing, publishing, and releasing Vit CLI (`@truongqv12/vit-cli`) to npm.

## Build Process

### Prerequisites

- Node.js ≥18.0.0
- npm ≥9.0.0 (or equivalently configured package manager)
- GitHub CLI (`gh`) for token operations during testing
- TypeScript 5.7.2 (dev dependency)

### Local Build

```bash
# Install dependencies
npm install

# Type check (no emit)
npm run typecheck

# Lint
npm run lint:fix

# Build (compile TypeScript → dist/)
npm run build

# Result: bin/vit.js + dist/ ready for testing
```

### Build Output

After `npm run build`:

```
dist/
├── index.js           # Main CLI entry point (compiled)
├── commands/
│   ├── init.js
│   ├── update.js
│   ├── doctor.js
│   ├── doctor-health-checks.js
│   ├── version.js
│   ├── plan/
│   ├── migrate/
│   └── portable/
├── fetch/
├── github/
├── install/
├── reconcile/
├── shared/
└── (all other src/ modules)

bin/
└── vit.js            # Binary wrapper (stays TypeScript, points to dist/index.js)
```

The `bin/vit.js` file is automatically executable via `npm link` or when installed globally from npm.

## Testing

### Unit & Integration Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test dist/commands/doctor.test.js

# Watch mode
npm test -- --watch
```

### Manual CLI Testing

```bash
# After build, test CLI locally
npm link
# Now `vit` command is available globally (symlink to local bin/vit.js)

vit --help
vit init --help
vit init --dry-run --verbose

# Unlink when done
npm unlink
```

### Testing with Mock GitHub

All tests use **mocked Octokit** (no real GitHub API calls):

```typescript
// Example test fixture
const mockRelease = {
  assets: [
    {
      name: "vit-engine-1.5.0.tar.gz",
      browser_download_url: "https://...",
    }
  ]
};

// Stub Octokit.repos.getReleaseByTag() to return mock
```

Tests must NEVER call real GitHub APIs; CI will fail if credentials are leaked.

## Publishing to npm

### Versioning Strategy

Vit CLI uses **Semantic Release** for automated versioning and publishing:

- **Major** (breaking change): `vit migrate` provider format changes incompatibly
- **Minor** (new feature): `vit plan` command added, new option introduced
- **Patch** (bug fix): Reconciler logic corrected, typo in error message

### Commit Message Format (Conventional Commits)

```bash
git commit -m "feat: add vit migrate command"     # → minor bump
git commit -m "fix: reconciler skips unchanged"   # → patch bump
git commit -m "docs: update README"               # → no version bump
git commit -m "chore: update dependencies"        # → no version bump
```

**Important**: `chore:` and `docs:` commits do NOT trigger a version bump. Use `fix:` or `feat:` for user-facing changes.

### Manual Publishing (NOT recommended — use CI instead)

If you must publish manually:

```bash
# Verify build + tests pass
npm run typecheck && npm test && npm run build

# Check package contents
npm pack --dry-run

# Publish to npm
npm publish

# Tag release in git
git tag -a v1.5.0 -m "Release 1.5.0"
git push origin v1.5.0
```

### Automated Publishing (Recommended via CI/CD)

**Trigger**: Merge to `main` branch on GitHub

**CI Workflow** (`.github/workflows/release.yml`):
1. Runs `semantic-release` (checks conventional commits since last tag)
2. Determines version bump
3. Updates `package.json` version + `CHANGELOG.md`
4. Builds (`npm run build`)
5. Runs pre-publish checks (`scripts/prepublish-check.js`)
6. Publishes to npm with `npm publish`
7. Creates GitHub release + git tag

**Dev Publishing** (`.github/workflows/release-dev.yml`):
- Merge to `dev` branch → publishes to npm with `@dev` tag
- Allows pre-release testing

## Package Configuration

### package.json Metadata

```json
{
  "name": "@truongqv12/vit-cli",
  "version": "1.5.0",
  "type": "module",
  "description": "Vit CLI — cài đặt, cập nhật và quản lý Vit Engine",
  "bin": {
    "vit": "bin/vit.js"
  },
  "files": [
    "bin/",
    "dist/"
  ],
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org"
  }
}
```

**Key Points**:
- **name**: Scoped to `@truongqv12/` (npm account namespace)
- **bin**: Exposes `vit` command globally when installed with `-g`
- **files**: Only `bin/` and `dist/` published (not `src/`, tests, etc)
- **publishConfig.access**: `public` ensures package is publicly available

### Pre-Publish Validation

**Script**: `scripts/prepublish-check.js`

Runs automatically before publish to verify:
1. `bin/vit.js` exists and is executable
2. `dist/` directory exists with all compiled files
3. `package.json` `files` array contains correct paths
4. No stray source files in publication

## Installation Methods

### Global Install (End Users)

```bash
npm install -g @truongqv12/vit-cli

# Now `vit` command is available
vit --version
vit init
```

### Local/Development Install

```bash
git clone https://github.com/truongqv12/vit-cli.git
cd vit-cli
npm install
npm run build
npm link        # Creates symlink to local bin/vit.js
vit --version   # Tests local build
```

### CI/CD Install

```bash
# In GitHub Actions or other CI
npm install -g @truongqv12/vit-cli

# Or: install from dev channel
npm install -g @truongqv12/vit-cli@dev
```

## Release Checklist

Before merging to `main` (triggers automatic release):

- [ ] **Code Quality**
  - [ ] `npm run typecheck` passes
  - [ ] `npm run lint:fix` passes
  - [ ] `npm test` passes
  - [ ] `npm run build` succeeds
  - [ ] No uncommitted changes

- [ ] **Documentation**
  - [ ] `docs/cli-reference.md` updated with new commands/options
  - [ ] `docs/codebase-summary.md` reflects code changes
  - [ ] User-facing error messages are clear and helpful

- [ ] **Testing**
  - [ ] Unit tests added for new logic
  - [ ] Integration tests cover reconciliation/migration logic
  - [ ] Manual testing with `npm link` completed
  - [ ] CI passes (all checks green)

- [ ] **Commit Messages**
  - [ ] Use conventional commit format (`feat:`, `fix:`, etc)
  - [ ] Commit messages describe user impact, not implementation
  - [ ] No `WIP`, `TODO`, or merge commits on main

- [ ] **Backwards Compatibility**
  - [ ] Existing CLI commands still work (no breaking changes without major version bump)
  - [ ] If breaking change: document migration path
  - [ ] Registry format backward-compatible (or migration provided)

### Release Notes Template

Semantic Release automatically generates release notes. Verify format:

```markdown
# 1.5.0 (2025-06-18)

## Features

- **migrate**: add support for Antigravity provider (#42)
- **plan**: add --start flag to mark phase in-progress

## Bug Fixes

- **reconciler**: preserve user-edited files on update
- **doctor**: fix hook wiring check false positives

## BREAKING CHANGES

- `migrate` command renamed from `export` (run `vit migrate --help`)
```

## Post-Release

### After npm Publish

1. **Verify Package on npm**
   ```bash
   npm view @truongqv12/vit-cli@1.5.0
   npm info @truongqv12/vit-cli
   ```

2. **Test Installation**
   ```bash
   npm install -g @truongqv12/vit-cli@1.5.0
   vit --version  # Should print 1.5.0
   ```

3. **GitHub Release**
   - Semantic Release creates GitHub release automatically
   - Verify release notes on GitHub

4. **Announce Release**
   - Update README version badge (if present)
   - Notify in team channels
   - Add to project roadmap (docs/project-overview-pdr.md)

## Troubleshooting Deployments

### Build Fails with TypeScript Errors

```bash
npm run typecheck  # Get detailed error report
# Fix errors, then retry build
npm run build
```

### Publish Permission Denied

```
npm ERR! 403 Forbidden
```

**Cause**: Not authenticated to npm with scoped package permissions.

**Solution**:
```bash
npm login
# Enter credentials for @truongqv12 npm account
npm publish
```

### dist/ Not Found During Publish

```
npm ERR! ENOENT: no such file or directory
```

**Cause**: Forgot to run `npm run build` before publish.

**Solution**:
```bash
npm run build
npm publish
```

### Package.json Version Mismatch

**Cause**: Manual version bump without semantic-release.

**Solution**: Let semantic-release handle versioning. Don't manually edit `package.json` version on main branch.

## Binary Distribution (Optional Future)

Currently, Vit CLI is distributed as npm package. Future enhancement: native binaries for macOS/Linux/Windows.

**Would require**:
- Build system (e.g., PKG or Neon for native Node bindings)
- Multi-platform CI (GitHub Actions matrix)
- Standalone binary releases on GitHub

**Current approach is sufficient** for npm distribution.

## Version Management

### Current Version

Check `package.json`:
```bash
jq '.version' package.json
```

### Checking for Updates

```bash
npm outdated              # Show outdated dependencies
npm update                # Update to latest compatible versions
npm audit                 # Security audit
```

### Pinning Dependencies

```json
{
  "dependencies": {
    "@octokit/rest": "^21.1.1",    // Allow minor updates
    "cac": "6.7.14"                // Exact version
  }
}
```

Semantic versioning (`^`, `~`, exact) handled in `package.json`. Security updates applied via Dependabot or `npm audit fix`.

## Documentation on Release

As of v1.5.0, all user-facing docs are in `docs/`:

- `cli-reference.md` — Command syntax, options, examples
- `project-overview-pdr.md` — Features, requirements, roadmap
- `system-architecture.md` — Technical design
- `code-standards.md` — Dev guidelines
- `codebase-summary.md` — Module structure
- `deployment-guide.md` — This file

On major feature releases, update relevant docs before merging to `main`.

## Monitoring Post-Release

### npm Registry

- Monitor download stats: https://npm-stat.com/@truongqv12/vit-cli
- Check issues reported on GitHub

### User Feedback

- GitHub Issues for bug reports
- Discussions for feature requests
- Update docs based on common questions

## Security & Credentials

### Never Commit Secrets

- No hardcoded GitHub tokens in code
- No API keys in config files
- Use environment variables in CI/CD

### GitHub Actions Secrets

Store sensitive values in GitHub repo settings:
- `GITHUB_TOKEN` (auto-generated per job)
- `NPM_TOKEN` (for npm publish authentication)

### Releasing with Credentials

- CI/CD handles npm publish automatically
- No manual intervention needed
- All secrets stay in GitHub's secure storage

## Rollback Plan

If a release is broken:

1. **Unpublish from npm** (only works within 24h):
   ```bash
   npm unpublish @truongqv12/vit-cli@1.5.0
   ```

2. **Delete GitHub Release**:
   - Go to GitHub releases page
   - Delete broken release + associated tag

3. **Fix & Republish**:
   - Revert commits or apply hotfix
   - Merge to `main` → CI auto-publishes new version

4. **Notify Users**:
   - GitHub issue explaining rollback
   - Recommend staying on previous version

## Unresolved Questions

None. Deployment pipeline stable via semantic-release automation. Future: native binary distribution (out of scope for v1.5.0).
