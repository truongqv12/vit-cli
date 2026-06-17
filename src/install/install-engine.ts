// Luồng chung cho `vit init` và `vit update`:
// resolve token -> tải engine -> nạp/sinh manifest -> reconcile vào .claude/ -> dọn tạm.
import path from "node:path";
import fs from "fs-extra";
import { fetchEngine } from "../github/engine-fetcher.js";
import { resolveToken } from "../github/token-resolver.js";
import { loadOrSynthesizeManifest } from "../reconcile/engine-manifest.js";
import { isNonInteractive } from "../shared/environment.js";
import { log } from "../shared/logger.js";
import { scaffoldEnvFile } from "./env-scaffold.js";
import { executeInstall } from "./install-executor.js";
import { handleSkillsInstallation } from "./skills/skill-deps-installer.js";
import { promptInstallSkills } from "./skills/skills-install-prompt.js";

export interface InstallEngineOptions {
	token?: string;
	force?: boolean;
	dryRun?: boolean;
	// Cài deps skill ngay không hỏi (cờ --install-skills).
	installSkills?: boolean;
	// Bỏ qua mọi prompt, tự đồng ý (cờ -y/--yes) — dùng cho script/CI.
	yes?: boolean;
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

		// Các bước hậu-cài chỉ chạy khi ghi thật (không dry-run).
		if (!options.dryRun) {
			const claudeDir = path.join(process.cwd(), ".claude");

			// 1) Scaffold .claude/.env từ .env.example nếu thiếu (không đè key user).
			await scaffoldEnvFile(claudeDir);

			// 2) Cài deps skill: mặc định HỎI khi tương tác; cờ --install-skills/-y bỏ qua hỏi.
			//    skipConfirm chỉ true khi đã quyết định cài (cờ hoặc non-interactive có cờ).
			let doInstall = Boolean(options.installSkills || options.yes);
			if (!doInstall && !isNonInteractive()) {
				doInstall = await promptInstallSkills();
			}
			if (doInstall) {
				const skillsDir = path.join(claudeDir, "skills");
				await handleSkillsInstallation(skillsDir, {
					skipConfirm: true, // đã đồng ý ở trên (cờ hoặc prompt)
					withSudo: options.withSudo,
				});
			}
		}
	} finally {
		await fs.remove(fetched.extractRoot).catch(() => {});
	}
}
