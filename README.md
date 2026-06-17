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

```bash
npm install -g vit
```

## Sử dụng

```bash
gh auth login                 # cấp quyền đọc engine private (một lần)
cd /đường/dẫn/project
vit doctor                    # kiểm tra môi trường
vit init                      # cài engine vào .claude/ của project
vit update                    # cập nhật engine lên bản mới nhất
vit update --dry-run          # xem trước thay đổi
vit version                   # phiên bản CLI + engine đã cài
```

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
| `vit init` | Cài engine vào `.claude/` (per-project). |
| `vit update` | Cập nhật engine; giữ file bạn đã sửa (trừ `--force`). `--dry-run` xem trước. |
| `vit plan` | `create` / `check` / `uncheck` / `status` cho thư mục plan. |
| `vit doctor` | Kiểm tra token, quyền engine, `.claude/`. |
| `vit version` | In phiên bản CLI + engine. |

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
