# Phase 02 — Types + provider-registry + thu thập installed hooks

## Context Links
- Overview: [plan.md](plan.md) · Trước: [phase-01](phase-01-port-core-modules.md)
- File đích: `migrate-types.ts`, `migrate-provider-registry.ts`, `migrate-installer.ts`

## Overview
- **Priority:** Cao
- **Status:** Chưa làm
- Mở rộng type + provider config để biết: (a) đường dẫn tuyệt đối file hook đã cài, (b) đường dẫn `.codex/hooks.json` và `.codex/config.toml`.

## Key Insights
- vit hiện KHÔNG track absolute path file hook đã cài → cần thêm field.
- provider-registry codex thiếu `settingsJsonPath` (cho hooks.json) và `featuresConfigPath` (cho config.toml).
- Target hooks.json = `.codex/hooks.json` (project) / `~/.codex/hooks.json` (global). **KHÔNG phải settings.json.**

## Requirements
### migrate-types.ts
Thêm vào `MigrateInstallResult`:
```ts
/** Đường dẫn tuyệt đối tới file đã cài (cần cho pipeline hooks Codex) */
installAbsolutePath?: string;
```
Thêm vào `ProviderConfig` (codex-only, optional):
```ts
/** Đường ghi hooks.json (project/global) — chỉ Codex */
hooksSettingsPath?: { projectPath: string; globalPath: string } | null;
/** Đường config.toml để bật [features] hooks — chỉ Codex */
featuresConfigPath?: { projectPath: string; globalPath: string } | null;
```

### migrate-provider-registry.ts (entry "codex")
Thêm:
```ts
hooksSettingsPath: {
  projectPath: ".codex/hooks.json",
  globalPath: join(home, ".codex/hooks.json"),
},
featuresConfigPath: {
  projectPath: ".codex/config.toml",
  globalPath: join(home, ".codex/config.toml"),
},
```
Provider khác (opencode, antigravity...): để `null`.

### migrate-installer.ts
Trong nhánh return success (sau khi ghi file, ~line 300), set:
```ts
installAbsolutePath: resolve(targetPath),
```
(đảm bảo `targetPath` đã là path đúng project/global; nếu là relative thì `resolve(process.cwd(), targetPath)`.)

## Architecture
```mermaid
flowchart LR
    INST[migrate-installer] -->|MigrateInstallResult + installAbsolutePath| CMD[migrate-command results[]]
    REG[provider-registry.codex] -->|hooksSettingsPath, featuresConfigPath| ORCH[Phase 03 orchestrator]
    CMD --> ORCH
```

## Related Code Files
- **Sửa:** `migrate-types.ts` (2 type), `migrate-provider-registry.ts` (entry codex), `migrate-installer.ts` (return)

## Implementation Steps
1. Thêm field `installAbsolutePath?` vào `MigrateInstallResult` (migrate-types.ts).
2. Thêm field `hooksSettingsPath?`, `featuresConfigPath?` vào `ProviderConfig`.
3. Điền 2 field cho entry `codex` trong provider-registry; các provider khác `null`/bỏ qua.
4. Set `installAbsolutePath: resolve(targetPath)` ở return success của installer (mọi loại, không chỉ hooks — rẻ và tiện).
5. `tsc --noEmit`.

## Todo List
- [ ] `MigrateInstallResult.installAbsolutePath`
- [ ] `ProviderConfig.hooksSettingsPath` + `featuresConfigPath`
- [ ] Điền config codex
- [ ] Set absolute path ở installer
- [ ] Typecheck sạch

## Success Criteria
- `results` sau migrate chứa `installAbsolutePath` cho mỗi hook.
- Lấy được đường `.codex/hooks.json` + `.codex/config.toml` từ provider-registry theo scope.

## Risk Assessment
- Lẫn project vs global path: test cả 2 scope ở Phase 04.
- `targetPath` có thể đã absolute (global) hoặc relative (project) — dùng `resolve` an toàn cả hai.

## Next Steps
→ Phase 03 (orchestrator gọi pipeline).
