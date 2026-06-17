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
