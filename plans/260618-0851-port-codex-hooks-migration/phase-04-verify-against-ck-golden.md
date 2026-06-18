# Phase 04 — Verify đối chiếu golden + publish

## Context Links
- Overview: [plan.md](plan.md) · Trước: [phase-03](phase-03-orchestration-merge-hooks.md)
- Golden: `C:\www\Ai\ck_test\.codex\` · Test target: `C:\www\Ai\vit_test\`

## Overview
- **Priority:** Cao
- **Status:** Chưa làm
- Build, test unit, migrate lại `vit_test`, đối chiếu output với golden ck, rồi commit + publish (semantic-release).

## Key Insights
- Tiêu chí "đúng" = output vit khớp golden ck về **event + command + features flag** (không cần khớp byte-byte phần thứ tự).
- Đây là điểm KẾT LUẬN cho câu hỏi mở: có cần wrapper hash không.

## Implementation Steps
1. `npm run build` (vit-cli) — sạch.
2. `npm test` — chạy `node --test dist/**/*.test.js`. Thêm test đơn vị cho:
   - `convertClaudeHooksToCodex`: drop SubagentStart/Stop/TaskCompleted/TeammateIdle, giữ UserPromptSubmit/PreToolUse.
   - `ensureCodexHooksFeatureFlag`: idempotent, ghi `[features] hooks=true`.
   - escape/path rewrite Windows (`\` → `/`).
3. Migrate thử trên `vit_test`:
   ```
   node C:\www\claudekit\vit-cli\bin\vit.js migrate --agent codex -f   # tại C:\www\Ai\vit_test
   ```
4. **Đối chiếu golden** (diff có chủ đích):
   - `vit_test/.codex/hooks.json` vs `ck_test/.codex/hooks.json`:
     - Cùng event keys: `UserPromptSubmit`, `PreToolUse`.
     - Cùng matcher `Bash|Glob|Grep|Read|Edit|Write`.
     - Command trỏ đúng dạng ck (path phẳng cho 3 hook hợp lệ).
   - `vit_test/.codex/hooks/` có file wrapper hash (`<hash>-<tên>.cjs`) tương ứng các hook cài (như ck_test).
   - `vit_test/.codex/config.toml` có block `[features] hooks=true`.
5. **Đối chiếu wrapper:** nội dung 1 file wrapper vit vs ck (cấu trúc spawn + scrub) tương đương về hành vi (không cần khớp byte tên hash).
6. Test thủ công trong Codex: mở `vit_test`, xác nhận hiện prompt "Hooks need review / 3 hooks are new or changed".
7. Nếu đạt: commit `fix(migrate): sinh .codex/hooks.json + bật features flag cho Codex hooks` → push main → semantic-release publish.
8. Cập nhật người dùng: `npm i -g @truongqv12/vit-cli@latest` rồi migrate lại các project.

## Bảng đối chiếu (điền khi chạy)
| Mục | Golden ck_test | vit_test sau fix | Đạt? |
|-----|----------------|------------------|------|
| hooks.json tồn tại | ✅ | ? | ⬜ |
| Event UserPromptSubmit → simplify-gate | ✅ | ? | ⬜ |
| Event PreToolUse → scout-block + privacy-block | ✅ | ? | ⬜ |
| matcher Bash\|Glob\|Grep\|Read\|Edit\|Write | ✅ | ? | ⬜ |
| File wrapper hash trong .codex/hooks/ | ✅ | ? | ⬜ |
| config.toml [features] hooks=true | ✅ | ? | ⬜ |
| Codex hiện "Hooks need review" | ✅ | ? | ⬜ |

## Todo List
- [ ] build sạch
- [ ] unit test mới pass
- [ ] migrate vit_test
- [ ] đối chiếu golden (bảng trên)
- [ ] kết luận wrapper (câu hỏi mở #1)
- [ ] test thủ công Codex
- [ ] commit + push + publish
- [ ] hướng dẫn user cập nhật

## Success Criteria
- Bảng đối chiếu 6/6 đạt.
- Codex hiện prompt review hook trên `vit_test`.
- Version mới publish lên npm.

## Risk Assessment
- Nếu output lệch ck (thiếu event / sai matcher) → quay lại Phase 03 sửa capability filtering.
- Nếu Codex vẫn không nhận hook dù có hooks.json → kiểm tra format hooks.json (so byte với golden) + vị trí file (project root `.codex/` đúng chưa).

## Security Considerations
- Trước publish: chạy quét secret cơ bản; không commit file test/secret.

## Next Steps
- Đóng plan, cập nhật trạng thái các phase trong plan.md.
- Cân nhắc đồng bộ ngược fix về tài liệu vit nếu có.
