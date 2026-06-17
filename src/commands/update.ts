// Lệnh `vit update` — cập nhật Vit Engine lên bản mới nhất.
// Khung Phase 1: reconcile delta + áp deletions sẽ được nối vào ở Phase 3.
import { log } from "../shared/logger.js";

export interface UpdateOptions {
	token?: string;
	force?: boolean;
	dryRun?: boolean;
}

export async function runUpdate(_options: UpdateOptions): Promise<void> {
	log.info("`vit update` đang được hoàn thiện ở Phase 3 (reconcile + deletions).");
	log.info("Luồng dự kiến: tải engine mới -> so checksum với registry -> áp delta/deletions -> giữ file user đã sửa (trừ --force).");
}
