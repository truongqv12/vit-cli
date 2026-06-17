// Lệnh `vit version` — in phiên bản CLI và engine đã cài.
import fs from "fs-extra";
import path from "node:path";
import { REGISTRY_FILE } from "../shared/config.js";
import { log } from "../shared/logger.js";

export const CLI_VERSION = "0.1.0";

export function printVersion(): void {
	log.plain(`vit CLI: ${CLI_VERSION}`);

	const registryPath = path.resolve(process.cwd(), REGISTRY_FILE);
	if (fs.existsSync(registryPath)) {
		try {
			const registry = fs.readJsonSync(registryPath) as { engineVersion?: string };
			log.plain(`Vit Engine (project này): ${registry.engineVersion ?? "không rõ"}`);
		} catch {
			log.warn("Không đọc được registry engine trong .claude/.vit/registry.json");
		}
	} else {
		log.info("Chưa cài engine vào project này (chạy `vit init`).");
	}
}
