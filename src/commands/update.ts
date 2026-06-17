// Lệnh `vit update` — cập nhật Vit Engine lên bản mới nhất (giữ file user đã sửa).
import fs from "fs-extra";
import path from "node:path";
import { installEngine } from "../install/install-engine.js";
import { REGISTRY_FILE } from "../shared/config.js";
import { log } from "../shared/logger.js";

export interface UpdateOptions {
	token?: string;
	force?: boolean;
	dryRun?: boolean;
}

export async function runUpdate(options: UpdateOptions): Promise<void> {
	try {
		const hasRegistry = fs.existsSync(path.resolve(process.cwd(), REGISTRY_FILE));
		if (!hasRegistry) {
			log.warn("Chưa cài engine ở project này — chạy `vit init` trước. Vẫn tiếp tục như cài mới.");
		}
		await installEngine({ token: options.token, force: options.force, dryRun: options.dryRun });
		if (!options.dryRun) log.ok("Cập nhật engine xong.");
	} catch (err) {
		log.error(err instanceof Error ? err.message : String(err));
		process.exitCode = 1;
	}
}
