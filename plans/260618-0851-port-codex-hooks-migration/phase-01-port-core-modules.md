# Phase 01 — Port 11 module core (theo thứ tự topo)

## Context Links
- Overview: [plan.md](plan.md)
- Nguồn: `C:\www\claudekit\clone\claudekit-cli\src\commands\portable\`
- Đích: `C:\www\claudekit\vit-cli\src\commands\portable\`

## Overview
- **Priority:** Cao (nền tảng cho Phase 02-03)
- **Status:** Chưa làm
- Port 11 module Codex hooks từ claudekit-cli sang vit-cli, đổi tên theo convention `migrate-*`, sửa import path, xử lý 2 dependency thiếu.

## Key Insights
- vit dùng kebab-case + prefix `migrate-`. Tên class/event Codex (SessionStart...) giữ nguyên.
- 2 dependency thiếu: `semver` (codex-capabilities), `proper-lockfile` (codex-path-safety).
- Nhiều module là **pure** (không I/O) → port gần như nguyên văn.

## Quyết định dependency — ĐÃ CHỐT (học theo claudekit)
| Dep | Module dùng | Hành động |
|-----|-------------|-----------|
| `semver` | migrate-codex-capabilities | **Thêm vào `package.json` dependencies.** Giữ `coerce`/`gte` nguyên văn upstream. |
| `proper-lockfile` | migrate-codex-path-safety | **Thêm vào `package.json` dependencies.** Giữ `withCodexTargetLock` dùng lock thật. |

> Cài: `npm i semver proper-lockfile` + `npm i -D @types/semver @types/proper-lockfile`. Port 1:1, không lược bỏ logic.

## Bảng port + đổi tên
| # | Nguồn (claudekit-cli) | Đích (vit-cli) | Loại |
|---|----------------------|----------------|------|
| 1 | `codex-capabilities.ts` | `migrate-codex-capabilities.ts` | sửa: bỏ semver |
| 2 | `codex-path-safety.ts` | `migrate-codex-path-safety.ts` | sửa: bỏ proper-lockfile |
| 3 | ~~gemini-hook-event-map~~ | — | **BỎ** (chỉ codex). Trong merger, cắt nhánh gọi `mapEventName`/`requiresHookMapping`. |
| 4 | `generated-context-hooks.ts` | đã có `generated-context-hooks.ts` ở vit | **dùng lại**, kiểm tra export `isGeneratedContextHookName` |
| 5 | `hook-migration-compatibility.ts` | `migrate-hook-compatibility.ts` | nguyên văn (bỏ phần gemini nếu có) |
| 6 | `converters/claude-to-codex-hooks.ts` | `converters/migrate-converter-claude-to-codex-hooks.ts` | sửa import capability |
| 7 | `codex-hook-wrapper.ts` | `migrate-codex-hook-wrapper.ts` | **port đầy đủ** (wrapper hash 1:1 claudekit) |
| 8 | `codex-features-flag.ts` | `migrate-codex-features-flag.ts` | sửa import path-safety |
| 9 | `migrated-hook-settings-cleanup.ts` | `migrate-hook-settings-cleanup.ts` | port (cleanup generated-context) |
| 10 | `migrated-hooks-cleanup.ts` | `migrate-hooks-cleanup.ts` | port (phụ thuộc registry) — bỏ nếu registry vit khác nhiều |
| 11 | `hooks-settings-merger.ts` | `migrate-hooks-settings-merger.ts` | **orchestrator** — cắt nhánh gemini, giữ codex |

> Chỉ codex: KHÔNG port module 3. Module 7 (wrapper) là **core bắt buộc** (đã chốt). Module 10 cân nhắc theo độ lệch registry vit vs ck.

## Thứ tự thực hiện (topo)
```
Lớp 0: migrate-codex-capabilities, migrate-codex-path-safety, migrate-hook-compatibility
Lớp 1: migrate-converter-claude-to-codex-hooks (←capabilities)
       migrate-codex-hook-wrapper (←path-safety)
       migrate-codex-features-flag (←path-safety)
Lớp 2: migrate-hooks-settings-merger (←tất cả)
```

## Implementation Steps
1. `npm i semver proper-lockfile` + `npm i -D @types/semver @types/proper-lockfile`. Kiểm tra build/tsconfig nhận types.
2. Port lớp 0. `migrate-codex-capabilities`: giữ nguyên `semver`, `CODEX_CAPABILITY_TABLE`, `detectCodexCapabilities`; env `CK_CODEX_COMPAT` → `VIT_CODEX_COMPAT` (vẫn đọc `CK_CODEX_COMPAT` làm fallback để tương thích).
3. `migrate-codex-path-safety`: port 1:1 với `proper-lockfile` (`withCodexTargetLock` dùng lock thật).
4. Port lớp 1 (claude-to-codex-hooks, codex-hook-wrapper, codex-features-flag), sửa import sang tên file vit.
5. Port `migrate-hooks-settings-merger` (orchestrator) — **cắt bỏ nhánh gemini-cli** (`mapEventName`, `requiresHookMapping`, `rewriteMatcherToolNames`), chỉ giữ đường codex. Chi tiết wiring ở Phase 03.
6. `tsc --noEmit` sau mỗi lớp để bắt lỗi type sớm.

## Related Code Files
- **Tạo mới:** 7-11 file ở `vit-cli/src/commands/portable/` + `.../converters/`
- **Sửa:** `package.json` (nếu thêm dep — mặc định không)
- **Dùng lại:** `vit-cli/src/commands/portable/generated-context-hooks.ts`

## Todo List
- [ ] `npm i semver proper-lockfile` + types
- [ ] Port `migrate-codex-capabilities.ts` (giữ semver; env VIT_CODEX_COMPAT + fallback CK_)
- [ ] Port `migrate-codex-path-safety.ts` (proper-lockfile thật)
- [ ] Port `migrate-hook-compatibility.ts`
- [ ] Port `migrate-converter-claude-to-codex-hooks.ts`
- [ ] Port `migrate-codex-hook-wrapper.ts` (đầy đủ)
- [ ] Port `migrate-codex-features-flag.ts`
- [ ] Port `migrate-hooks-settings-merger.ts` (cắt nhánh gemini)
- [ ] `tsc --noEmit` sạch

## Success Criteria
- Tất cả module compile sạch (`npm run typecheck`).
- Không thêm dep ngoài trừ khi đã chốt.
- Export API tương đương upstream (cho Phase 03 gọi).

## Risk Assessment
- `semver`/`proper-lockfile` phải nằm trong `package.json` `files`/bundle khi publish (vit publish cả `dist/` — kiểm tra dep được resolve runtime, không bị tree-shake mất).
- `proper-lockfile` tạo file `.lock` trong `.codex/` — đảm bảo không commit nhầm vào repo người dùng (thêm vào `.gitignore` hướng dẫn nếu cần).
- ESM import `semver`/`proper-lockfile`: vit dùng `"type": "module"` — kiểm tra cú pháp import (named vs default) đúng.

## Security Considerations
- Giữ `isPathWithinBoundary` để chặn path traversal khi ghi `.codex/`.

## Next Steps
→ Phase 02 (types + provider-registry + thu thập installed hooks).
