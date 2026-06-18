# Plan: Port hệ thống Codex hooks migration vào vit-cli

## Bối cảnh
`vit migrate --agent codex` copy file `.cjs` vào `.codex/hooks/` nhưng **không sinh `.codex/hooks.json`** và **không bật `[features] hooks = true`** trong `.codex/config.toml`. Hậu quả: Codex không đăng ký hook → không hiện prompt "Hooks need review" → hook không chạy. `ck migrate` làm đúng vì có cả subsystem Codex hooks mà vit bị lược bỏ khi port.

**Mục tiêu:** vit sinh output hook khớp `ck` (đối chiếu golden `C:\www\Ai\ck_test\.codex`): `hooks.json` đúng event + `[features] hooks=true`.

## Golden reference (đã verify)
- Nguồn: `.claude/settings.json` mục `hooks` (events: SessionStart, UserPromptSubmit, SubagentStart, PreToolUse, PostToolUse, SubagentStop, Stop, TaskCompleted, TeammateIdle).
- ck lọc còn 3 hook hợp lệ Codex → `.codex/hooks.json`:
  - `UserPromptSubmit` → `node "$CLAUDE_PROJECT_DIR"/.codex/hooks/simplify-gate.cjs`
  - `PreToolUse` (matcher `Bash|Glob|Grep|Read|Edit|Write`) → `scout-block.cjs`, `privacy-block.cjs`
- `.codex/config.toml`: block managed `[features] hooks = true`.

## Luồng đích (sau khi port)
```mermaid
flowchart TD
    A[vit migrate --agent codex] --> B[Copy file .cjs vào .codex/hooks/]
    B --> C[Thu thập installedHookFiles + abs paths từ results]
    C --> D[detectCodexCapabilities: chạy codex --version]
    D --> E[readHooksFromSettings: đọc .claude/settings.json]
    E --> F[filterToInstalledHooks: chỉ giữ hook đã cài]
    F --> G[convertClaudeHooksToCodex: lọc event/matcher theo capability + rewrite path]
    G --> H[writeHooksJson: ghi .codex/hooks.json]
    H --> I[ensureCodexHooksFeatureFlag: bật [features] hooks=true]
    I --> J[Báo cáo: N hook registered]
```

## Phạm vi & quyết định chốt (user đã duyệt)
- **Port đầy đủ, học theo claudekit 1:1** — bao gồm `codex-hook-wrapper` (sinh wrapper hash). Output sẽ tự khớp golden ck (project scope: 3 hook trỏ path phẳng trong `hooks.json`, file wrapper hash đồng tồn trong `.codex/hooks/` cho các hook khác).
- **Chỉ codex** — KHÔNG port nhánh gemini-cli (`gemini-hook-event-map`, `mapEventName`...). Bỏ mọi nhánh provider khác (YAGNI).
- **Thêm dependency thật** (học theo claudekit): `semver` (codex-capabilities), `proper-lockfile` (codex-path-safety). KHÔNG inline-simplify.
- **Target settings = `.codex/hooks.json`** (KHÔNG phải `.codex/settings.json` — bằng chứng ck_test).

## Các phase
| Phase | Nội dung | Trạng thái |
|-------|----------|-----------|
| [01](phase-01-port-core-modules.md) | Port module core theo thứ tự topo + thêm dep semver/proper-lockfile | ✅ Xong |
| [02](phase-02-wiring-types-provider-installer.md) | Thêm type + field provider-registry + installAbsolutePath | ✅ Xong |
| [03](phase-03-orchestration-merge-hooks.md) | Orchestrator: pipeline sau install, ghi hooks.json + features flag | ✅ Xong |
| [04](phase-04-verify-against-ck-golden.md) | Build, test, đối chiếu golden, migrate vit_test, publish | ✅ Verify xong (review DONE_WITH_CONCERNS → đã xử lý H1/H2/M2) |

## Code review (đã xử lý)
- **H1** regex prune chỉ bắt POSIX → sửa bắt cả Windows drive path. ✅
- **H2** `registerCodexHooks` chưa try/catch → bọc try/catch chống nuốt output. ✅
- **M2** thiếu test phần tự viết → thêm 2 test (e2e orchestrator + prune Windows + idempotent). ✅ 157/157 pass.
- **M1** (lock hooks.json): bỏ — upstream claudekit cũng không lock, CLI 1 tiến trình (YAGNI).
- **M3** (direct-copy rewrite `.claude/`→`.codex/` thân hook): hành vi có sẵn dùng chung ck, thực nghiệm OK → follow-up.
- **L2** (sentinel `ck-managed`): giữ để tương thích self-heal với ck.

## Kết quả thực tế (đã chạy)
- typecheck sạch · build sạch · **155/155 test pass** (6 test mới cho hooks).
- Chạy `vit migrate --agent codex -f` trên `C:\www\Ai\vit_test`:
  - `.codex/hooks.json`: 3 hook (UserPromptSubmit→simplify-gate, PreToolUse matcher `Bash|Glob|Grep|Read|Edit|Write`→scout-block+privacy-block). ✅
  - `.codex/config.toml`: block `[features] hooks=true`. ✅
  - Wrapper hash sinh trong `.codex/hooks/` (đúng claudekit). ✅
  - Cảnh báo khớp ck (drop SubagentStart/Stop, excluded usage-quota...). ✅
- Khác golden ck_test: vit dùng path wrapper-hash (do command nguồn vit_test ở dạng `.claude/hooks/X` tương đối → khớp substitution); ck_test dùng `$CLAUDE_PROJECT_DIR` phẳng. Cả hai hợp lệ; vit theo đúng hành vi wrapper của claudekit (QĐ #1).

## Phụ thuộc giữa các phase
01 → 02 → 03 → 04 (tuần tự; 03 phụ thuộc cả 01 và 02).

## Rủi ro chính
- `codex --version` không có trên máy người dùng → cần fallback "most-restrictive" (đã có trong upstream).
- Windows path / dấu `\` trong command string — phải normalize forward-slash.
- `proper-lockfile` thêm dep nặng cho project scope; cân nhắc đơn giản hoá.
- Sai lệch event filtering so với ck → Phase 04 đối chiếu byte-level với golden.

## Câu hỏi mở — ĐÃ CHỐT
1. ✅ Wrapper: **port đầy đủ theo claudekit** (không bỏ).
2. ✅ Chỉ codex (bỏ gemini-cli).
3. ✅ Thêm dep thật `semver` + `proper-lockfile` (không inline-simplify).

## Ngoài phạm vi (theo dõi riêng)
- **Skill deps:** `vit migrate` (và init) hiện KHÔNG cài skill dependencies (python venv: google-genai, pillow... như `ck init` làm). Đây là gap RIÊNG, không thuộc port hooks. Sẽ xử lý ở plan kế tiếp sau khi hooks xong.
