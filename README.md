# Vit CLI

CLI cài đặt, cập nhật và quản lý **Vit Engine** (rules / skills / agents) cho [Claude Code](https://docs.claude.com/en/docs/claude-code/overview).

> Engine là repo **private** — `vit` truy cập qua GitHub token. Đăng nhập `gh auth login` (hoặc đặt `GITHUB_TOKEN`) trước khi dùng.

## Cài đặt

### Giai đoạn đầu — qua git repo (chưa publish npm)

```bash
git clone https://github.com/your-org/vit-cli.git
cd vit-cli
npm install
npm run build
npm link        # tạo lệnh `vit` toàn cục
```

### Sau này — qua npm

Tên `vit` và `vit-cli` đã có người giữ trên npm, nên package dùng tên scoped (lệnh vẫn là `vit`):

```bash
npm install -g @truongqv12/vit-cli
```

## Sử dụng

```bash
gh auth login                 # cấp quyền đọc engine private (một lần)
cd /đường/dẫn/project
vit doctor                    # kiểm tra môi trường + hook wiring + skill
vit init                      # cài engine + HỎI cài deps skill + tạo .claude/.env
vit init --install-skills     # cài luôn deps skill, không hỏi
vit init -y                   # tự đồng ý mọi prompt (script/CI)
vit update                    # cập nhật engine lên bản mới nhất
vit update --dry-run          # xem trước thay đổi
vit migrate --dry-run         # xem kế hoạch xuất .claude/ sang provider khác
vit version                   # phiên bản CLI + engine đã cài
```

Khi chạy `vit init` trong terminal tương tác, sau khi cài file engine vào `.claude/`, CLI sẽ:

1. Cài thêm file cấp **project-root**: `plans/templates/` (mẫu plan), `.gitignore`, `.repomixignore`. File bạn đã có/đã sửa sẽ được giữ (không ghi đè; dùng `--force` mới đè).
2. Tạo `.claude/.env` từ `.env.example` nếu chưa có (giữ nguyên nếu bạn đã điền key).
3. Hỏi **"Cài deps skill ngay?"** (mặc định Không) — đồng ý thì chạy `install.sh`/`install.ps1` cài python venv + npm cho skill.
4. Cảnh báo nếu có bản `vit` CLI mới trên npm (chỉ nhắc, không tự cài).

Trong CI / non-interactive (không TTY), bước hỏi tự bỏ qua; dùng `--install-skills` hoặc `-y` để cài không hỏi. Nhớ điền API key (GEMINI/OPENROUTER/MINIMAX) vào `.claude/.env` khi cần.

Sau khi `vit init`, mở Claude Code và dùng các slash-command của engine:

```text
/vit:plan "thêm xác thực người dùng"
/vit:cook /đường/dẫn/plans/<plan>/plan.md
/vit:scout "tìm chỗ xử lý upload"
/vit:fix "lỗi đăng nhập"
```

## Lệnh

| Lệnh | Mô tả |
| --- | --- |
| `vit init` | Cài engine vào `.claude/` (per-project) + tạo `.claude/.env` + hỏi cài deps skill. `--install-skills` cài không hỏi; `-y/--yes` tự đồng ý; `--with-sudo` (Linux) gồm gói hệ thống. |
| `vit update` | Cập nhật engine; giữ file bạn đã sửa (trừ `--force`). `--dry-run` xem trước. Merge `settings.json` (giữ hook/config bạn thêm). |
| `vit migrate` | Xuất `.claude/` (agents/skills/rules/hooks/commands) sang **codex / opencode / antigravity**. Chọn provider: `-a/--agent <list>` (lặp được hoặc CSV), `--all`, `--providers` (alias). Ghi đè: `-f/--force`, `-y/--yes`, `--dry-run`, `-g/--global`. Lọc loại: `--only-agents/--only-commands/--only-skills`, `--config`, `--rules`, `--hooks`, `--skip-*`. Khác: `--source <path>` (CLAUDE.md tùy biến, chỉ config), `--install`/`--reconcile`. |
| `vit plan` | `create` / `check` / `uncheck` / `status` cho thư mục plan. |
| `vit doctor` | Kiểm tra token, quyền engine, `.claude/`, hook wiring, skill. |
| `vit version` | In phiên bản CLI + engine. |

### Ví dụ `vit migrate`

```bash
vit migrate --dry-run                          # xem kế hoạch, không ghi
vit migrate --agent codex                       # 1 provider
vit migrate --agent codex -f                    # cài lại cả khi không đổi (đè + backup)
vit migrate -a codex -a opencode                # nhiều provider (lặp cờ)
vit migrate --agent codex,opencode              # nhiều provider (CSV)
vit migrate --all                               # cả 3: codex, opencode, antigravity
vit migrate --agent codex --only-agents         # chỉ agents
vit migrate --agent codex --skip-skills         # mọi loại trừ skills
vit migrate --providers codex,opencode          # alias cũ vẫn chạy
```

> Hook của bạn vẫn được migrate (chỉ Codex nhận hook; OpenCode/Antigravity không hỗ trợ). Riêng nhóm
> hook **generated-context** của engine (session-init, dev-rules-reminder, plan-format-kanban…) bị bỏ
> qua vì chúng bơm context theo định dạng riêng của Claude, không chạy được trên agent khác.

### Ví dụ `vit plan`

```bash
vit plan create --title "Thêm xác thực" --phases "Nghiên cứu, Triển khai, Kiểm thử" --dir auth
cd plans/<date>-auth
vit plan check 1 --start     # phase 1 -> đang làm
vit plan check 2             # phase 2 -> xong
vit plan status              # in tiến độ
```

## Trạng thái phát triển

- [x] Phase 1 — khung CLI + engine + đổi tên `vit:`
- [x] Phase 2 — truy cập engine private qua `gh`, tải/giải nén
- [x] Phase 3 — `init`/`update` reconcile theo manifest + deletions
- [x] Phase 4 — lệnh `plan`
- [x] Phase 5 — skill `memory` (native) + release pipeline
- [x] Phase 6 — bê toàn bộ engine (89 skill, 13 agent, 129 hook) + rename `vit:`
- [x] Phase 7 — manifest + release cho full tree
- [x] Phase 8 — cài deps skill (`--install-skills`, chạy `install.sh`/`install.ps1`)
- [x] Phase 9 — merge `settings.json` (giữ hook/config user) + prune zombie hook
- [x] Phase 10 — lệnh `migrate` (codex / opencode / antigravity)
- [x] Phase 11 — doctor health-check + audit rename
