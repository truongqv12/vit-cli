// Luồng chung cho `vit init` và `vit update`:
// resolve token -> tải engine -> nạp/sinh manifest -> reconcile vào .claude/ -> dọn tạm.
import path from "node:path";
import fs from "fs-extra";
import { fetchEngine } from "../github/engine-fetcher.js";
import { resolveToken } from "../github/token-resolver.js";
import { loadOrSynthesizeManifest } from "../reconcile/engine-manifest.js";
import { log } from "../shared/logger.js";
import { executeInstall } from "./install-executor.js";
import { handleSkillsInstallation } from "./skills/skill-deps-installer.js";

export interface InstallEngineOptions {
	token?: string;
	force?: boolean;
	dryRun?: boolean;
	// Cài deps skill (python venv, npm...) sau khi reconcile — opt-in qua cờ --install-skills.
	installSkills?: boolean;
	withSudo?: boolean;
}

export async function installEngine(options: InstallEngineOptions): Promise<void> {
	const token = resolveToken(options.token);
	const fetched = await fetchEngine(token);
	try {
		const manifest = await loadOrSynthesizeManifest(fetched.engineDir, fetched.bundledManifestPath, fetched.version);
		if (manifest.files.length === 0) {
			log.warn("Manifest rỗng — không có file engine nào để cài. Kiểm tra lại payload engine.");
			return;
		}
		log.info(`Engine ${manifest.version}: ${manifest.files.length} file payload.`);
		await executeInstall(process.cwd(), fetched.engineDir, manifest, {
			force: options.force,
			dryRun: options.dryRun,
		});

		// Sau khi file đã vào .claude/, cài deps skill nếu user opt-in (không chạy khi dry-run).
		if (options.installSkills && !options.dryRun) {
			const skillsDir = path.join(process.cwd(), ".claude", "skills");
			await handleSkillsInstallation(skillsDir, {
				skipConfirm: true, // opt-in qua cờ = đã đồng ý
				withSudo: options.withSudo,
			});
		}
	} finally {
		await fs.remove(fetched.extractRoot).catch(() => {});
	}
}
