// Lệnh `vit init` — cài Vit Engine vào .claude/ của project hiện tại.
import { installEngine } from "../install/install-engine.js";
import { log } from "../shared/logger.js";

export interface InitOptions {
	token?: string;
	force?: boolean;
}

export async function runInit(options: InitOptions): Promise<void> {
	try {
		await installEngine({ token: options.token, force: options.force });
		log.ok("Cài engine xong. Mở Claude Code và dùng /vit:plan, /vit:cook, /vit:scout, /vit:fix.");
	} catch (err) {
		log.error(err instanceof Error ? err.message : String(err));
		process.exitCode = 1;
	}
}
