// Hỏi user có cài deps skill ngay không — học cơ chế claudekit-cli (mặc định hỏi khi tương tác).
// In bảng deps trước để user hiểu mình đồng ý cài gì (educate, không confirm mù).
import { confirm, isCancel } from "@clack/prompts";
import { isNonInteractive } from "../../shared/environment.js";
import { log } from "../../shared/logger.js";

// In tóm tắt deps mà script install.sh/install.ps1 sẽ cài.
function printDepsNote(): void {
	log.plain("");
	log.info("Deps skill sẽ được cài (qua .claude/skills/install script):");
	log.plain("  - Python (vào ~/.claude/skills/.venv): google-genai, pillow, pypdf, requests, python-dotenv");
	log.plain("  - Node: repomix, pnpm");
	log.plain("  - Hệ thống (tuỳ chọn): ffmpeg, imagemagick");
	log.plain("");
}

// Trả true nếu user đồng ý cài. Tự thoát (false) khi không tương tác để tránh treo.
export async function promptInstallSkills(): Promise<boolean> {
	if (isNonInteractive()) {
		return false;
	}

	printDepsNote();

	const answer = await confirm({
		message: "Cài deps skill ngay?",
		initialValue: false, // mặc định No — an toàn, tránh chạy script ngoài ý muốn.
	});

	// Ctrl+C / ESC → coi như từ chối, không ném lỗi.
	if (isCancel(answer)) {
		log.info("Bỏ qua cài deps skill. Có thể chạy lại sau với cờ --install-skills.");
		return false;
	}

	if (!answer) {
		log.info("Bỏ qua cài deps skill. Có thể chạy lại sau với cờ --install-skills.");
	}

	return answer === true;
}
