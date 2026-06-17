// Lệnh `vit version` — in phiên bản CLI và engine đã cài bằng panel đẹp.
import fs from "fs-extra";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REGISTRY_FILE } from "../shared/config.js";
import { log } from "../shared/logger.js";
import { printPanel } from "../shared/ui/ui.js";

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
	const registryPath = path.resolve(process.cwd(), REGISTRY_FILE);

	if (fs.existsSync(registryPath)) {
		let engineVersion = "không rõ";
		try {
			const registry = fs.readJsonSync(registryPath) as { engineVersion?: string };
			engineVersion = registry.engineVersion ?? "không rõ";
		} catch {
			// Không đọc được registry — báo cảnh báo riêng nhưng vẫn hiện panel CLI
			log.warn("Không đọc được registry engine trong .claude/.vit/registry.json");
		}

		// Hiển thị panel 2 zone: CLI + Engine
		printPanel({
			title: "Vit",
			zones: [
				{ label: "CLI", lines: [`v${CLI_VERSION}`] },
				{ label: "Engine (project này)", lines: [engineVersion] },
			],
		});
	} else {
		// Engine chưa cài — hiển thị panel nhỏ với gợi ý
		printPanel({
			title: "Vit",
			zones: [
				{ label: "CLI", lines: [`v${CLI_VERSION}`] },
				{ label: "Engine", lines: ["Chưa cài vào project này — chạy `vit init`."] },
			],
		});
	}
}
