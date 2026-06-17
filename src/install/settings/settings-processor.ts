// Xử lý settings.json riêng (không qua reconcile file-phẳng): merge engine vào bản user,
// prune wiring hook chết, ghi atomic. Idempotent — chạy nhiều lần cho cùng kết quả.
import fs from "fs-extra";
import path from "node:path";
import { RUNTIME_DIR } from "../../shared/config.js";
import { log } from "../../shared/logger.js";
import { mergeSettings } from "./settings-merger.js";
import type { SettingsJson } from "./settings-types.js";
import { pruneZombieHooks } from "./zombie-hook-pruner.js";

const SETTINGS_FILE = "settings.json";

async function readJsonSafe(file: string): Promise<SettingsJson | null> {
	if (!(await fs.pathExists(file))) return null;
	try {
		return (await fs.readJson(file)) as SettingsJson;
	} catch {
		return null;
	}
}

// Ghi atomic: file tạm + rename, tránh hỏng settings nếu ghi dở.
async function atomicWriteJson(file: string, data: SettingsJson): Promise<void> {
	const tmp = `${file}.tmp`;
	await fs.ensureDir(path.dirname(file));
	await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
	await fs.move(tmp, file, { overwrite: true });
}

export interface ProcessSettingsOptions {
	engineDir: string;
	projectRoot: string;
	dryRun?: boolean;
}

export async function processSettings(options: ProcessSettingsOptions): Promise<void> {
	const { engineDir, projectRoot, dryRun } = options;
	const enginePath = path.join(engineDir, SETTINGS_FILE);
	const targetPath = path.resolve(projectRoot, RUNTIME_DIR, SETTINGS_FILE);

	const engine = await readJsonSafe(enginePath);
	if (!engine) {
		log.warn("Engine không có settings.json hợp lệ — bỏ qua merge settings.");
		return;
	}

	const user = (await readJsonSafe(targetPath)) ?? {};
	const merged = mergeSettings(engine, user);

	if (merged.hooks) {
		const { pruned, removed } = pruneZombieHooks(merged.hooks, projectRoot);
		merged.hooks = pruned;
		if (removed.length > 0) {
			log.info(`Dọn ${removed.length} wiring hook chết (file không tồn tại).`);
		}
	}

	if (dryRun) {
		const events = merged.hooks ? Object.keys(merged.hooks).length : 0;
		log.plain(`  [settings] sẽ merge settings.json (${events} nhóm hook).`);
		return;
	}

	await atomicWriteJson(targetPath, merged);
	log.ok("Đã merge settings.json (giữ cấu hình user, cập nhật hook engine).");
}
