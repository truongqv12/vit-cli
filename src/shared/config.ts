// Cấu hình tĩnh của Vit CLI.
import { homedir } from "node:os";
import path from "node:path";

// Repo engine PRIVATE — CLI tải nội dung từ đây qua GitHub token.
// TODO: cập nhật owner/repo thật khi tạo repo trên GitHub.
export const ENGINE_REPO = {
	owner: "your-org",
	repo: "vit-engine",
	branch: "main",
} as const;

// Thư mục runtime Claude Code trong project user.
export const RUNTIME_DIR = ".claude";

// Thư mục state nội bộ của Vit trong project (registry, backups).
export const VIT_STATE_DIR = path.join(RUNTIME_DIR, ".vit");
export const REGISTRY_FILE = path.join(VIT_STATE_DIR, "registry.json");
export const BACKUP_DIR = path.join(VIT_STATE_DIR, "backups");

// Thư mục cache tải engine (ngoài project, theo home).
export const CACHE_DIR = path.join(homedir(), ".vit", "cache");
