## [1.6.0](https://github.com/truongqv12/vit-cli/compare/v1.5.3...v1.6.0) (2026-06-18)

### 🚀 Features

* **migrate:** đăng ký Codex hooks (.codex/hooks.json + features flag) ([28bf686](https://github.com/truongqv12/vit-cli/commit/28bf686bab5c801bd7e3755c70c27c9b000d90f2))

## [1.5.3](https://github.com/truongqv12/vit-cli/compare/v1.5.2...v1.5.3) (2026-06-18)

### 🐞 Bug Fixes

* **migrate:** escape backslash khi sinh TOML agent Codex ([beb1f49](https://github.com/truongqv12/vit-cli/commit/beb1f4977d25ef1daa5935a9e41cf8387e385420))

## [1.5.2](https://github.com/truongqv12/vit-cli/compare/v1.5.1...v1.5.2) (2026-06-17)

### 📚 Documentation

* viết lại README bằng tiếng Việt (giới thiệu, lệnh, cài đặt, phát triển) ([181d2f2](https://github.com/truongqv12/vit-cli/commit/181d2f2f678bdaf4dd629568cfcf93d15e0c78b4))

## [1.5.1](https://github.com/truongqv12/vit-cli/compare/v1.5.0...v1.5.1) (2026-06-17)

### 🐞 Bug Fixes

* **install:** trỏ lỗi cài skill tới log thật thay vì cờ VIT_VERBOSE vô tác dụng ([b2326b8](https://github.com/truongqv12/vit-cli/commit/b2326b8bdac234d8c60346ecd9c6142d391d66b6))

### 📚 Documentation

* thêm bộ tài liệu vit-cli (overview, codebase, architecture, standards, cli-reference, deploy) ([af644a5](https://github.com/truongqv12/vit-cli/commit/af644a50b14f574314398dc148bb326aa35b6827))

## [1.5.0](https://github.com/truongqv12/vit-cli/compare/v1.4.0...v1.5.0) (2026-06-17)

### 🚀 Features

* **ui:** redesign output sang phong cách clack + progress bar tải/cài engine ([602bb34](https://github.com/truongqv12/vit-cli/commit/602bb34a721649d2a452ca93b28f42256c754340))

## [1.4.0](https://github.com/truongqv12/vit-cli/compare/v1.3.0...v1.4.0) (2026-06-17)

### 🚀 Features

* **migrate:** parity cờ + ngữ nghĩa với ck migrate ([018ea65](https://github.com/truongqv12/vit-cli/commit/018ea6586b288edc7c9fc4835dd0b08c3360dcf6))

## [1.3.0](https://github.com/truongqv12/vit-cli/compare/v1.2.0...v1.3.0) (2026-06-17)

### 🚀 Features

* **install:** cài file project-root + cảnh báo có bản CLI mới ([b2e9d7e](https://github.com/truongqv12/vit-cli/commit/b2e9d7ec748fb581df754ac157a21669a0e18e87))

## [1.2.0](https://github.com/truongqv12/vit-cli/compare/v1.1.0...v1.2.0) (2026-06-17)

### 🚀 Features

* **init:** hỏi cài deps skill khi tương tác và tự tạo .claude/.env ([f31bae4](https://github.com/truongqv12/vit-cli/commit/f31bae44dfe5cb459fd29f1e3e5de437aa1c2c81))

### 🐞 Bug Fixes

* **init:** cảnh báo khi thiếu .env.example trong payload thay vì bỏ qua câm ([2ea60c0](https://github.com/truongqv12/vit-cli/commit/2ea60c0db51659e585ae6424d4d1f3e9f730d9f8))

## [1.1.0](https://github.com/truongqv12/vit-cli/compare/v1.0.0...v1.1.0) (2026-06-17)

### 🚀 Features

* cài deps skill khi init/update (--install-skills) ([724123a](https://github.com/truongqv12/vit-cli/commit/724123a5b99f1581dfd47ca2ade3fe5e81d3623e))
* doctor kiểm hook wiring + skill (phát hiện zombie wiring, đếm skill) ([cef482e](https://github.com/truongqv12/vit-cli/commit/cef482ef234cb6a33517bf2268ac818ab2e0b687))
* lệnh vit migrate xuất .claude/ sang codex/opencode/antigravity ([edfd48d](https://github.com/truongqv12/vit-cli/commit/edfd48d844b0d587521b33c8621b2856d5bba7f0))
* merge settings.json thay vì đè (giữ hook/config user) + prune zombie hook ([9fb1c1c](https://github.com/truongqv12/vit-cli/commit/9fb1c1ceb11b69ca76cb1bf10fd97fbec62c08b6))

### 📚 Documentation

* cập nhật README (migrate, --install-skills, doctor health-check, phase 6-11) ([162b17c](https://github.com/truongqv12/vit-cli/commit/162b17c081c2330e612bde994d089dabbee69c3a))

## 1.0.0 (2026-06-17)

### 🚀 Features

* khởi tạo Vit CLI — khung cac, lệnh doctor/version, stub init/update ([7433c1e](https://github.com/truongqv12/vit-cli/commit/7433c1e243d47b52b21cb87bc1f6e81caf6fd150))
* lệnh vit plan create/check/uncheck/status (scaffold + trạng thái phase) ([a2f6d65](https://github.com/truongqv12/vit-cli/commit/a2f6d65557649cc14413e7c8ffde57fc289a8bb1))
* tải engine private qua gh + reconcile init/update theo manifest/registry ([f839def](https://github.com/truongqv12/vit-cli/commit/f839def03e01b642f0bf7233919205cba7bf2ea9))
* trỏ ENGINE_REPO owner sang truongqv12 ([3e2245b](https://github.com/truongqv12/vit-cli/commit/3e2245b6abeb658bdf5108f1fd1f74074b297426))

### 🐞 Bug Fixes

* bỏ registry-url ở setup-node (tránh .npmrc placeholder làm semantic-release 401) ([50c6158](https://github.com/truongqv12/vit-cli/commit/50c61584419e2c3f2cb74eb9a3d504ef46ba4796))
* vá rà soát — chống path traversal (tar+action), reconcile chịu lỗi từng file, fetcher phân biệt 401/404, cảnh báo manifest rỗng ([d263698](https://github.com/truongqv12/vit-cli/commit/d2636981d0746731c3e11ab68965b09bda78a08b))
* version đọc runtime từ package.json, loại symlink khi giải nén, retry lock Windows; release config + publishConfig theo claudekit-cli ([33f993c](https://github.com/truongqv12/vit-cli/commit/33f993c04cebe241357c2d1fde6f5b859596391a))

### 📚 Documentation

* bổ sung lệnh plan và đánh dấu tiến độ phase trong README ([6cc4d2c](https://github.com/truongqv12/vit-cli/commit/6cc4d2ceed9662356192871df6b265fcbfdf4635))
