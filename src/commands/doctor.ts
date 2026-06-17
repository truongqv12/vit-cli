// Lệnh `vit doctor` — kiểm tra môi trường, in kết quả dạng panel tổng hợp.
import { execFileSync } from "node:child_process";
import fs from "fs-extra";
import path from "node:path";
import { REGISTRY_FILE, RUNTIME_DIR } from "../shared/config.js";
import { log } from "../shared/logger.js";
import { printPanel } from "../shared/ui/ui.js";
import type { PanelZone } from "../shared/ui/ui.js";
import { checkHookWiring, checkSkills } from "./doctor-health-checks.js";

// ─── Kiểm tra từng mục, trả về PanelZone ──────────────────────────────────

function checkNodeZone(): PanelZone {
	const ver = process.versions.node;
	const major = Number(ver.split(".")[0]);
	return {
		label: "Node",
		lines: major >= 18
			? [`✓ Node ${ver}`]
			: [`✗ Node ${ver} — cần >= 18`],
	};
}

function checkTokenZone(): PanelZone {
	if (process.env.GITHUB_TOKEN) {
		return { label: "Token", lines: ["✓ GITHUB_TOKEN có trong môi trường."] };
	}
	try {
		const token = execFileSync("gh", ["auth", "token"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		if (token) {
			return { label: "Token", lines: ["✓ Lấy được token qua `gh auth token`."] };
		}
	} catch {
		// gh chưa cài hoặc chưa đăng nhập
	}
	return {
		label: "Token",
		lines: ["⚠ Không có token. Chạy `gh auth login` hoặc đặt GITHUB_TOKEN."],
	};
}

function checkEngineZone(projectRoot: string): PanelZone {
	const runtimePath = path.resolve(projectRoot, RUNTIME_DIR);
	if (!fs.existsSync(runtimePath)) {
		return {
			label: "Engine",
			lines: [`✗ Chưa có ${RUNTIME_DIR}/ — chạy \`vit init\` để cài engine.`],
		};
	}

	const registryPath = path.resolve(projectRoot, REGISTRY_FILE);
	if (fs.existsSync(registryPath)) {
		return { label: "Engine", lines: [`✓ Có ${RUNTIME_DIR}/ và registry engine (đã cài bằng vit).`] };
	}
	return {
		label: "Engine",
		lines: [
			`✓ ${RUNTIME_DIR}/ tồn tại`,
			`⚠ Chưa có registry vit — có thể cài đè bằng \`vit init\`.`,
		],
	};
}

// ─── Entry point ───────────────────────────────────────────────────────────

export function runDoctor(): void {
	const projectRoot = process.cwd();

	// Thu kết quả các check chính vào zones để hiển thị bằng panel
	const zones: PanelZone[] = [
		checkNodeZone(),
		checkTokenZone(),
		checkEngineZone(projectRoot),
	];

	printPanel({
		title: "Vit Doctor",
		subtitle: "Kiểm tra môi trường",
		zones,
	});

	// Kiểm sức khoẻ engine chi tiết (hook wiring + skill) — in log.* riêng vì
	// module ngoài scope; chỉ chạy khi engine đã cài.
	const runtimePath = path.resolve(projectRoot, RUNTIME_DIR);
	if (fs.existsSync(runtimePath)) {
		checkHookWiring(projectRoot);
		checkSkills(projectRoot);
	}
}
