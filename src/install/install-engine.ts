// Luồng chung cho `vit init` và `vit update`:
// resolve token -> tải engine -> nạp/sinh manifest -> reconcile vào .claude/ -> dọn tạm.
import fs from "fs-extra";
import { fetchEngine } from "../github/engine-fetcher.js";
import { resolveToken } from "../github/token-resolver.js";
import { loadOrSynthesizeManifest } from "../reconcile/engine-manifest.js";
import { log } from "../shared/logger.js";
import { executeInstall } from "./install-executor.js";

export interface InstallEngineOptions {
	token?: string;
	force?: boolean;
	dryRun?: boolean;
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
	} finally {
		await fs.remove(fetched.extractRoot).catch(() => {});
	}
}
