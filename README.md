# Vit CLI

Công cụ dòng lệnh cài đặt, cập nhật và quản lý **Vit Engine** (rules / skills / agents) cho [Claude Code](https://docs.claude.com/en/docs/claude-code/overview).

## Giới thiệu

Vit CLI (`vit`) cung cấp những lệnh thiết yếu để khởi tạo, cập nhật, và xuất Vit Engine — một bộ công cụ AI hỗ trợ phát triển toàn diện cho Claude Code. Engine được lưu trữ trong repo **private** trên GitHub; bạn cần GitHub token (`gh auth login` hoặc `GITHUB_TOKEN`) để truy cập.

**Tính năng chính:**
- **Cài đặt**: Tải Vit Engine từ GitHub, giải nén vào `.claude/`
- **Cập nhật**: Nâng cấp engine, giữ lại file bạn đã sửa
- **Xuất (Migrate)**: Chuyển `.claude/` sang các platform khác (Codex, OpenCode, Antigravity)
- **Quản lý Plan**: Tạo, theo dõi tiến độ các phase dự án
- **Kiểm tra sức khỏe**: Xác minh token, quyền, cấu trúc `.claude/`, hook wiring, skill deps
- **Thông minh Merge**: Phát hiện xung đột, bảo toàn tùy chỉnh người dùng
- **Cross-Platform**: macOS, Linux, Windows (PowerShell/Bash)

## Yêu cầu

Trước khi sử dụng Vit CLI, hãy đảm bảo bạn có:

1. **Node.js >= 18.0.0** — kiểm tra: `node --version`
2. **GitHub CLI** — cài đặt và đăng nhập: `gh auth login`
3. **GitHub Token** — chạy `gh auth login` chọn "Login with a web browser"
4. **Quyền truy cập**: Được mời vào private repo `truongqv12/vit-engine`

Nếu không có token hoặc không có quyền, `vit init` sẽ báo lỗi.

## Cài đặt

Vit CLI được phát hành trên npm tại [@truongqv12/vit-cli](https://www.npmjs.com/package/@truongqv12/vit-cli).

### Cách 1: npm (khuyên dùng)

```bash
npm install -g @truongqv12/vit-cli
```

### Cách 2: yarn

```bash
yarn global add @truongqv12/vit-cli
```

### Cách 3: pnpm

```bash
pnpm add -g @truongqv12/vit-cli
```

### Cách 4: Từ repo (phát triển)

```bash
git clone https://github.com/your-org/vit-cli.git
cd vit-cli
npm install
npm run build
npm link        # Tạo lệnh `vit` toàn cục
```

Sau cài đặt, kiểm tra:

```bash
vit --version
```

## Sử dụng nhanh

### Thiết lập lần đầu

```bash
# Đăng nhập GitHub (một lần)
gh auth login

# Di chuyển tới folder project
cd /đường/dẫn/project

# Cài Vit Engine
vit init

# Kiểm tra sức khỏe
vit doctor
```

### Các lệnh chính

| Lệnh | Mô tả | Chi tiết |
|------|-------|---------|
| `vit init` | Cài Vit Engine vào `.claude/` | Tải engine từ GitHub, merge settings, hỏi cài deps skill |
| `vit update` | Cập nhật engine lên bản mới | Giữ lại file user đã sửa; dùng `--dry-run` để xem trước |
| `vit migrate` | Xuất `.claude/` sang provider khác | Hỗ trợ: codex, opencode, antigravity |
| `vit plan` | Quản lý project plans | create / check / uncheck / status |
| `vit doctor` | Kiểm tra sức khỏe | Token, quyền, `.claude/`, hook, skill |
| `vit version` | In phiên bản | CLI version + engine đã cài |

Chi tiết: xem [docs/cli-reference.md](./docs/cli-reference.md).

## Ví dụ

### Cài đặt (interactive)

```bash
vit init
```

Hệ thống sẽ:
1. Xác minh GitHub token
2. Tải Vit Engine từ private repo
3. Cài file vào `.claude/`
4. Tạo `.claude/.env` từ template
5. Hỏi: "Cài dependency của skill ngay không?" (chọn Yes/No)

### Cài đặt không hỏi (CI/CD)

```bash
vit init -y --install-skills
```

Bỏ qua tất cả prompt, tự cài xong.

### Cập nhật

```bash
vit update --dry-run      # Xem thay đổi trước
vit update                 # Cập nhật thực sự
```

### Xuất sang OpenCode

```bash
vit migrate --agent opencode --dry-run     # Xem trước
vit migrate --agent opencode                # Xuất thực sự
```

Hoặc xuất sang nhiều platform:

```bash
vit migrate --agent codex -a opencode -a antigravity --dry-run
vit migrate --all                           # Xuất sang cả 3
```

### Tạo plan

```bash
vit plan create --title "Thêm xác thực" --phases "Nghiên cứu, API, UI, Kiểm thử" --dir auth

# Di chuyển vào folder plan
cd plans/20250618-1430-auth

# Theo dõi tiến độ
vit plan check 1              # Phase 1 xong
vit plan check 2 --start      # Phase 2 đang làm
vit plan status               # In progress
```

### Kiểm tra sức khỏe

```bash
vit doctor        # Báo cáo đầy đủ
vit doctor --verbose  # Chi tiết debug
```

## Tài liệu

Tài liệu chi tiết trong `/docs`:

- **[CLI Reference](./docs/cli-reference.md)** — Hướng dẫn lệnh, option, ví dụ chi tiết
- **[Project Overview & PDR](./docs/project-overview-pdr.md)** — Yêu cầu, tính năng, lộ trình
- **[System Architecture](./docs/system-architecture.md)** — Kiến trúc, luồng dữ liệu
- **[Code Standards](./docs/code-standards.md)** — Quy tắc mã, best practices
- **[Deployment Guide](./docs/deployment-guide.md)** — Quy trình release
- **[Codebase Summary](./docs/codebase-summary.md)** — Tổng quan cấu trúc

## Phát triển

### Cấu trúc dự án

```
src/
├── index.ts              # Điểm vào CLI
├── commands/             # Lệnh (init, update, migrate, plan, doctor, version)
├── domains/              # Logic nghiệp vụ (github, installation, migration, skills)
├── services/             # Service chung (file ops, package installer)
└── shared/               # Tiện ích (logger, UI, path resolver)
```

### Build & Test

```bash
npm run build          # Biên dịch TypeScript
npm test               # Chạy test
npm run typecheck      # Kiểm tra type
npm run dev [args]     # Chạy dev: npm run dev init
```

### Quality Gate

Trước khi commit/push, chạy:

```bash
npm run build
npm test
npm run typecheck
```

## Lập kế hoạch

Quá trình phát triển theo phases:

- [x] Phase 1 — Khung CLI + engine + đổi tên `vit:`
- [x] Phase 2 — Truy cập engine private via `gh`, tải/giải nén
- [x] Phase 3 — `init`/`update` reconcile theo manifest
- [x] Phase 4 — Lệnh `plan`
- [x] Phase 5 — Skill `memory` + release pipeline
- [x] Phase 6 — Bê toàn bộ engine + đổi tên `vit:`
- [x] Phase 7 — Manifest + release full tree
- [x] Phase 8 — Cài deps skill (`--install-skills`)
- [x] Phase 9 — Merge `settings.json` + prune orphaned hooks
- [x] Phase 10 — Lệnh `migrate` (codex / opencode / antigravity)
- [x] Phase 11 — `doctor` health-check

## Xử lý sự cố

Chạy `vit doctor` để chẩn đoán:

```bash
vit doctor           # Kiểm tra tất cả
vit doctor --verbose # Chi tiết
```

**Vấn đề thường gặp:**

| Lỗi | Giải pháp |
|-----|----------|
| "No GitHub token" | Chạy `gh auth login` |
| "403 Forbidden" | Kiểm tra token scope (`repo`), quyền truy cập repo |
| "Network timeout" | Kiểm tra kết nối, firewall/proxy |
| "File permission denied" | Kiểm tra quyền `.claude/` |
| Skill install fail | Chạy `vit init --install-skills` để thử lại |

## Giấy phép

MIT

---

**Inspired by [ClaudeKit](https://claudekit.cc)** — lấy cảm hứng từ cấu trúc và UX của ClaudeKit CLI.
