// Lệnh `vit version` — in phiên bản CLI và engine đã cài.
import fs from "fs-extra";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REGISTRY_FILE } from "../shared/config.js";
import { log } from "../shared/logger.js";

// Đọc version từ package.json lúc chạy để luôn khớp bản đã publish (không hardcode).
function readCliVersion(): string {
	try {
		const here = path.dirname(fileURLToPath(import.meta.url)); // dist/commands
		const pkg = fs.readJsonSync(path.resolve(here, "../../package.json")) as { version?: string };
		return pkg.version ?? "0.0.0";
	} catch {
		return "0.0.0";
	}
}

export const CLI_VERSION = readCliVersion();

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
