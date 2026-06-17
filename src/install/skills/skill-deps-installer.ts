// Cài deps cho skill bằng script engine ship sẵn (.claude/skills/install.sh | install.ps1).
// Học cơ chế claudekit-cli: chọn script theo platform, validate path, stream output,
// xử lý exit code (2=partial OK, 1=critical), resume qua state file.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { isCIEnvironment, isNonInteractive } from "../../shared/environment.js";
import { log } from "../../shared/logger.js";
import {
	checkNeedsSudoPackages,
	displayInstallErrors,
	hasInstallState,
} from "./install-error-display.js";
import { executeInteractiveScript } from "./process-executor.js";
import { validateScriptPath } from "./script-path-validator.js";

const EXIT_CRITICAL = 1;
const EXIT_PARTIAL = 2;
const SCRIPT_TIMEOUT_MS = 600000; // 10 phút cho skill nặng (python venv, npm).

export interface SkillsInstallOptions {
	// true khi user opt-in qua cờ --install-skills (đồng nghĩa đồng ý chạy script).
	skipConfirm?: boolean;
	// Linux: gồm gói hệ thống cần sudo (ffmpeg, imagemagick).
	withSudo?: boolean;
}

export interface SkillsInstallResult {
	success: boolean;
	partial?: boolean;
	error?: string;
}

export async function installSkillsDependencies(
	skillsDir: string,
	options: SkillsInstallOptions = {},
): Promise<SkillsInstallResult> {
	const { skipConfirm = false, withSudo = false } = options;

	if (isCIEnvironment()) {
		log.info("Môi trường CI — bỏ qua cài deps skill.");
		return { success: false, error: "Bỏ qua trong CI" };
	}
	// Không tương tác mà không opt-in rõ ràng → bỏ qua an toàn.
	if (isNonInteractive() && !skipConfirm) {
		log.info("Chế độ không tương tác — bỏ qua cài deps skill. Xem INSTALLATION.md để cài tay.");
		return { success: false, error: "Bỏ qua chế độ không tương tác" };
	}

	const isWin = process.platform === "win32";
	const scriptName = isWin ? "install.ps1" : "install.sh";
	const scriptPath = join(skillsDir, scriptName);

	try {
		validateScriptPath(skillsDir, scriptPath);
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Lỗi không rõ";
		log.error(`Đường dẫn script không hợp lệ: ${msg}`);
		return { success: false, error: msg };
	}

	if (!existsSync(scriptPath)) {
		log.warn(`Không thấy script cài skill: ${scriptPath}`);
		log.info(`Cài tay: xem ${join(skillsDir, "INSTALLATION.md")}`);
		return { success: false, error: "Không tìm thấy script cài" };
	}

	log.info(`Chạy script cài deps skill: ${scriptPath}`);
	log.info(`Nền tảng: ${isWin ? "Windows (PowerShell)" : "Unix (bash)"}`);

	// Resume nếu lần trước dở dang.
	const scriptArgs = ["--yes"];
	if (hasInstallState(skillsDir)) {
		log.info("Tiếp tục lần cài trước (resume)...");
		scriptArgs.push("--resume");
	}

	// Linux: gói hệ thống cần sudo.
	if (process.platform === "linux" && (await checkNeedsSudoPackages())) {
		if (withSudo) {
			log.warn("Cài gói hệ thống qua sudo: ffmpeg, imagemagick");
			scriptArgs.push("--with-sudo");
		} else {
			log.warn("Bỏ qua gói hệ thống (thiếu --with-sudo). Cài tay: sudo apt-get install -y ffmpeg imagemagick");
		}
	}

	const env = { ...process.env, NON_INTERACTIVE: "1" };

	try {
		if (isWin) {
			await executeInteractiveScript(
				"powershell.exe",
				["-NoLogo", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-Y"],
				{ timeout: SCRIPT_TIMEOUT_MS, cwd: skillsDir, env },
			);
		} else {
			await executeInteractiveScript("bash", [scriptPath, ...scriptArgs], {
				timeout: SCRIPT_TIMEOUT_MS,
				cwd: skillsDir,
				env,
			});
		}
		log.ok("Đã cài deps skill xong.");
		return { success: true };
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Lỗi không rõ";
		const m = msg.match(/mã (\d+)/);
		const exitCode = m ? Number.parseInt(m[1], 10) : 1;

		if (exitCode === EXIT_PARTIAL) {
			displayInstallErrors(skillsDir);
			log.ok("Chức năng lõi vẫn dùng được dù vài gói tuỳ chọn lỗi.");
			return { success: true, partial: true };
		}
		if (exitCode === EXIT_CRITICAL) {
			displayInstallErrors(skillsDir);
			log.error("Cài deps skill thất bại — xem chi tiết phía trên.");
			return { success: false, error: "Thiếu deps nghiêm trọng" };
		}
		log.error(`Lỗi bất ngờ khi cài skill: ${msg}`);
		log.info(`Cài tay: xem ${join(skillsDir, "INSTALLATION.md")}`);
		return { success: false, error: msg };
	}
}

// Wrapper: gọi cài + log gọn, không ném lỗi ra ngoài (không chặn init).
export async function handleSkillsInstallation(
	skillsDir: string,
	options: SkillsInstallOptions = {},
): Promise<void> {
	try {
		const r = await installSkillsDependencies(skillsDir, options);
		if (r.success) {
			log.ok(r.partial ? "Đã cài deps lõi (vài gói tuỳ chọn bỏ qua)." : "Đã cài deps skill.");
		} else {
			log.warn(`Cài deps skill chưa trọn: ${r.error || "lỗi không rõ"}. Có thể cài tay sau (INSTALLATION.md).`);
		}
	} catch {
		log.warn("Cài deps skill thất bại — có thể cài tay sau.");
	}
}
