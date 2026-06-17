// Kiểm tra sức khoẻ engine đã cài: wiring hook khớp file thực, đếm skill.
import fs from "fs-extra";
import path from "node:path";
import { RUNTIME_DIR } from "../shared/config.js";
import { log } from "../shared/logger.js";

// Trích path .claude/...cjs|js trong command hook (sau khi chuẩn slash).
function hookFileRef(command: string): string | null {
	const m = command.replace(/\\/g, "/").replace(/"/g, "").match(/\.claude\/([^\s"']+\.c?js)\b/);
	return m ? m[1] : null;
}

// Kiểm settings.json: mọi wiring hook trỏ tới file .claude/hooks/* phải tồn tại.
export function checkHookWiring(projectRoot: string): void {
	const settingsPath = path.resolve(projectRoot, RUNTIME_DIR, "settings.json");
	if (!fs.existsSync(settingsPath)) {
		log.info("Chưa có settings.json — bỏ qua kiểm hook wiring.");
		return;
	}

	let settings: { hooks?: Record<string, unknown[]>; statusLine?: { command?: string } };
	try {
		settings = fs.readJsonSync(settingsPath);
	} catch {
		log.warn("settings.json không phải JSON hợp lệ.");
		return;
	}

	const commands: string[] = [];
	JSON.stringify(settings, (k, v) => {
		if (k === "command" && typeof v === "string") commands.push(v);
		return v;
	});

	let total = 0;
	const missing: string[] = [];
	for (const cmd of commands) {
		const ref = hookFileRef(cmd);
		if (!ref) continue;
		total++;
		if (!fs.existsSync(path.resolve(projectRoot, RUNTIME_DIR, ref))) missing.push(ref);
	}

	if (total === 0) {
		log.info("settings.json không tham chiếu hook nào.");
	} else if (missing.length === 0) {
		log.ok(`Hook wiring OK: ${total}/${total} hook trỏ tới file tồn tại.`);
	} else {
		log.warn(`${missing.length}/${total} wiring hook trỏ tới file KHÔNG tồn tại (zombie):`);
		for (const m of missing) log.plain(`  - ${m}`);
		log.info("Chạy `vit update` để merge lại settings (tự dọn wiring chết).");
	}
}

// Đếm skill + báo có script cài deps không.
export function checkSkills(projectRoot: string): void {
	const skillsDir = path.resolve(projectRoot, RUNTIME_DIR, "skills");
	if (!fs.existsSync(skillsDir)) {
		log.info("Chưa có thư mục skills.");
		return;
	}
	const entries = fs
		.readdirSync(skillsDir, { withFileTypes: true })
		.filter((e) => e.isDirectory());
	log.ok(`Có ${entries.length} skill trong ${RUNTIME_DIR}/skills/.`);

	const isWin = process.platform === "win32";
	const installScript = path.join(skillsDir, isWin ? "install.ps1" : "install.sh");
	if (fs.existsSync(installScript)) {
		log.info("Có script cài deps skill — chạy `vit init --install-skills` để cài python/npm deps.");
	}
}
