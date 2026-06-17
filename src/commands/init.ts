// Lệnh `vit init` — cài Vit Engine vào .claude/ của project.
// Khung Phase 1: logic tải engine (Phase 2) + reconcile (Phase 3) sẽ được nối vào đây.
import { log } from "../shared/logger.js";

export interface InitOptions {
	token?: string;
	force?: boolean;
}

export async function runInit(_options: InitOptions): Promise<void> {
	log.info("`vit init` đang được hoàn thiện ở Phase 2 (tải engine) và Phase 3 (reconcile).");
	log.info("Luồng dự kiến: resolve token -> tải release asset engine -> reconcile vào .claude/ -> ghi registry.");
}
