# Phase 03 — Orchestrator: ghi hooks.json + bật features flag

## Context Links
- Overview: [plan.md](plan.md) · Trước: [phase-02](phase-02-wiring-types-provider-installer.md)
- File đích: `migrate-command.ts`, `migrate-hooks-settings-merger.ts`

## Overview
- **Priority:** Cao (mấu chốt — đây là bước làm hook chạy)
- **Status:** Chưa làm
- Sau khi copy file hook xong, gọi pipeline: đọc `.claude/settings.json` → lọc theo capability + file đã cài → ghi `.codex/hooks.json` → bật `[features] hooks=true`.

## Key Insights
- vit migrate-command hiện kết thúc ở vòng install rồi `printResults`. Chèn bước hooks **sau vòng install, trước printResults** (Agent 2: ~migrate-command.ts:139-142).
- Source provider luôn là claude-code; đọc `.claude/settings.json` (project hoặc global tuỳ scope).
- Chỉ chạy pipeline khi target provider = codex VÀ có ≥1 hook cài thành công.

## Hàm orchestrator (migrate-hooks-settings-merger.ts)
Chữ ký rút gọn cho vit (chỉ codex):
```ts
export async function migrateCodexHooksSettings(options: {
  installedHookFiles: string[];          // basenames
  installedHookAbsolutePaths: string[];  // abs paths file .cjs đã cài
  claudeSettingsPath: string;            // .claude/settings.json nguồn
  hooksJsonPath: string;                 // .codex/hooks.json đích
  configTomlPath: string;                // .codex/config.toml
  hooksDir: string;                      // .codex/hooks (để rewrite path)
  sourceHooksDir: string;                // .claude/hooks (path gốc trong command)
  global: boolean;
}): Promise<MigrateHooksResult>
```
Các bước (bám upstream `hooks-settings-merger.ts`):
1. `detectCodexCapabilities()` (Phase 01).
2. `readHooksFromSettings(claudeSettingsPath)` → `HooksSection | null`.
3. `filterToInstalledHooks(hooks, installedHookFiles)` — chỉ giữ command trỏ file đã cài.
4. `generateCodexHookWrappers(installedHookAbsolutePaths, hooksDir, capabilities)` — sinh wrapper hash + trả `commandSubstitutions` map (theo claudekit, đã chốt).
5. `convertClaudeHooksToCodex(hooks, capabilities, pathRewrite{commandSubstitutions})` — drop event/matcher không hỗ trợ, rewrite path qua map wrapper (phase 1) + dir fallback (phase 2).
6. Ghi `.codex/hooks.json` (atomic write, merge nếu file đã tồn tại).
7. `ensureCodexHooksFeatureFlag(configTomlPath)`.
8. Trả số hook đã đăng ký + danh sách wrapper + warnings.

> **Wrapper: port đầy đủ theo claudekit** (đã chốt). Output sẽ tự khớp golden ck — Phase 04 đối chiếu cả file wrapper hash lẫn nội dung `hooks.json`.

## Wiring trong migrate-command.ts
```mermaid
flowchart TD
    L[Vòng install mọi provider] --> R[results[]]
    R --> F{target có codex<br/>và có hook thành công?}
    F -- không --> P[printResults]
    F -- có --> AGG[Lọc results: provider=codex, type=hooks, success]
    AGG --> PATHS[installedHookFiles + installedHookAbsolutePaths]
    PATHS --> CALL[migrateCodexHooksSettings ...]
    CALL --> LOG[log: N hook registered / warnings]
    LOG --> P
```
Vị trí chèn: sau khối `for (const provider ...)` (Agent 2: migrate-command.ts ~line 139), trước `printResults(results)`.

Resolve đường dẫn từ provider-registry (Phase 02) theo `isGlobal`:
- `hooksJsonPath` = codex.hooksSettingsPath.{project|global}
- `configTomlPath` = codex.featuresConfigPath.{project|global}
- `claudeSettingsPath` = `.claude/settings.json` (project) / `~/.claude/settings.json` (global)

## Related Code Files
- **Tạo:** `migrate-hooks-settings-merger.ts` (đã port khung ở Phase 01; hoàn thiện logic ghi + merge ở đây)
- **Sửa:** `migrate-command.ts` (chèn bước orchestration + import)

## Implementation Steps
1. Hoàn thiện `migrateCodexHooksSettings` (đọc/lọc/convert/ghi/flag).
2. Viết `readHooksFromSettings`, `writeHooksJson` (atomic, merge), tái dùng `convertClaudeHooksToCodex` + `ensureCodexHooksFeatureFlag`.
3. Chèn wiring vào migrate-command.ts sau vòng install.
4. Thêm log thân thiện (giống ck: "Disabling N generated-context hook(s)", "N applied", cảnh báo event không hỗ trợ).
5. `tsc --noEmit`.

## Todo List
- [ ] `readHooksFromSettings`
- [ ] `filterToInstalledHooks`
- [ ] `writeHooksJson` (atomic + merge file cũ)
- [ ] `migrateCodexHooksSettings` ghép đủ bước
- [ ] Wiring migrate-command.ts + import
- [ ] Log/cảnh báo
- [ ] Typecheck sạch

## Success Criteria
- Chạy `vit migrate --agent codex -f` sinh `.codex/hooks.json` + `[features] hooks=true`.
- Số hook registered khớp golden ck (3 hook: simplify-gate, scout-block, privacy-block).

## Risk Assessment
- Merge khi hooks.json đã tồn tại: tránh nhân đôi entry (dedup theo command).
- Event filtering lệch ck → đối chiếu byte ở Phase 04.
- Đọc settings.json global vs project sai scope → test cả hai.

## Security Considerations
- Atomic write (temp + rename) tránh hỏng file giữa chừng.
- `isPathWithinBoundary` trước khi ghi `.codex/`.

## Next Steps
→ Phase 04 (verify + publish).
