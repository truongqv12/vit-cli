// Đọc và hiển thị lỗi chi tiết từ install.sh/install.ps1.
// Script engine ghi .install-error-summary.json (lỗi) + .install-state.json (resume).
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { log } from "../../shared/logger.js";

interface InstallErrorSummary {
	exit_code: number;
	critical_failures: string[];
	optional_failures: string[];
	skipped: string[];
	remediation: {
		sudo_packages?: string;
		winget_packages?: string;
		build_tools?: string;
		pip_retry?: string;
	};
}

function parseNameReason(s: string): [string, string | undefined] {
	const i = s.indexOf(":");
	return i === -1 ? [s.trim(), undefined] : [s.slice(0, i).trim(), s.slice(i + 1).trim()];
}

// Hiển thị lỗi cài skill từ summary file; dùng chính chuỗi remediation do script engine sinh.
export function displayInstallErrors(skillsDir: string): void {
	const summaryPath = join(skillsDir, ".install-error-summary.json");
	if (!existsSync(summaryPath)) {
		// Script cài (install.ps1/.sh) chưa kịp ghi summary (thường do crash giữa chừng).
		// Lỗi pip thật được ghi theo từng skill ở .venv/logs/install-<skill>.log —
		// trỏ user tới đó thay vì VIT_VERBOSE (cờ này KHÔNG ảnh hưởng script cài).
		const logDir = join(skillsDir, ".venv", "logs");
		log.error("Cài skill thất bại trước khi kịp ghi tóm tắt lỗi.");
		log.info(`Xem log chi tiết từng skill tại: ${logDir}`);
		log.info(`Cài lại tay: xem ${join(skillsDir, "INSTALLATION.md")}`);
		return;
	}

	let summary: InstallErrorSummary;
	try {
		summary = JSON.parse(readFileSync(summaryPath, "utf-8"));
	} catch {
		log.error("Không đọc được error summary (file có thể hỏng).");
		return;
	}

	if (summary.critical_failures?.length) {
		log.error("--- Lỗi nghiêm trọng ---");
		for (const f of summary.critical_failures) {
			const [name, reason] = parseNameReason(f);
			log.error(`  x ${name}${reason ? ` — ${reason}` : ""}`);
		}
	}
	if (summary.optional_failures?.length) {
		log.warn("--- Gói tuỳ chọn lỗi ---");
		for (const f of summary.optional_failures) {
			const [name, reason] = parseNameReason(f);
			log.warn(`  ! ${name}${reason ? ` — ${reason}` : ""}`);
		}
	}
	if (summary.skipped?.length) {
		log.info("--- Bỏ qua (thiếu sudo) ---");
		for (const s of summary.skipped) log.info(`  ~ ${parseNameReason(s)[0]}`);
	}

	const rem = summary.remediation || {};
	const fixes = [rem.build_tools, rem.winget_packages, rem.sudo_packages, rem.pip_retry].filter(
		Boolean,
	) as string[];
	if (fixes.length) {
		log.info("--- Cách khắc phục ---");
		for (const cmd of fixes) log.info(`  ${cmd}`);
	}

	try {
		unlinkSync(summaryPath);
	} catch {
		// ENOENT hoặc race — bỏ qua.
	}
}

export function hasInstallState(skillsDir: string): boolean {
	return existsSync(join(skillsDir, ".install-state.json"));
}

// Linux: kiểm ffmpeg + imagemagick (convert) có thiếu không → cần sudo.
export async function checkNeedsSudoPackages(): Promise<boolean> {
	if (process.platform !== "linux") return false;
	const { exec } = await import("node:child_process");
	const { promisify } = await import("node:util");
	const execAsync = promisify(exec);
	try {
		await Promise.all([
			execAsync("which ffmpeg", { timeout: 5000 }),
			execAsync("which convert", { timeout: 5000 }),
		]);
		return false;
	} catch {
		return true;
	}
}
