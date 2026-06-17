// Scaffold .claude/.env từ .env.example mà engine ship sẵn.
// Chỉ tạo khi file đích CHƯA tồn tại — không bao giờ đè key của user.
import { join } from "node:path";
import fs from "fs-extra";
import { log } from "../shared/logger.js";

// Tạo .claude/.env từ .claude/.env.example nếu thiếu. An toàn gọi nhiều lần (idempotent).
export async function scaffoldEnvFile(claudeDir: string): Promise<void> {
	const envPath = join(claudeDir, ".env");
	const examplePath = join(claudeDir, ".env.example");

	// Đã có .env → giữ nguyên (file bảo vệ), không động vào.
	if (await fs.pathExists(envPath)) {
		log.info(".claude/.env đã tồn tại — giữ nguyên.");
		return;
	}

	// Không có template để copy → bỏ qua nhẹ nhàng.
	if (!(await fs.pathExists(examplePath))) {
		return;
	}

	try {
		await fs.copy(examplePath, envPath);
		log.ok("Đã tạo .claude/.env từ .env.example.");
		log.info("Điền API key (GEMINI_API_KEY / OPENROUTER_API_KEY / MINIMAX_API_KEY) vào .claude/.env khi cần.");
	} catch (err) {
		// Không chặn init nếu copy lỗi.
		log.warn(`Không tạo được .claude/.env: ${err instanceof Error ? err.message : String(err)}`);
	}
}
