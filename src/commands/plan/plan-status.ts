// Đọc & cập nhật trạng thái phase trong plan.md (bảng "## Phases").
import fs from "fs-extra";
import path from "node:path";
import { log } from "../../shared/logger.js";
import { STATUS_ACTIVE, STATUS_DONE, STATUS_PENDING } from "./plan-scaffold.js";

// Tìm plan.md: target là file/thư mục (dùng <dir>/plan.md); nếu rỗng, dùng ./plan.md ở cwd.
export function resolvePlanFile(target?: string): string | null {
	if (target) {
		const abs = path.resolve(target);
		if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
			const inDir = path.join(abs, "plan.md");
			return fs.existsSync(inDir) ? inDir : null;
		}
		return fs.existsSync(abs) ? abs : null;
	}
	const cwdPlan = path.resolve(process.cwd(), "plan.md");
	return fs.existsSync(cwdPlan) ? cwdPlan : null;
}

const ROW_RE = /^\|\s*(\d+)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|\s*$/;

// Đổi trạng thái 1 phase theo số thứ tự. status = pending|active|done.
export async function setPhaseStatus(
	planFile: string,
	phaseNum: number,
	status: "pending" | "active" | "done",
): Promise<void> {
	const label = status === "done" ? STATUS_DONE : status === "active" ? STATUS_ACTIVE : STATUS_PENDING;
	const lines = (await fs.readFile(planFile, "utf8")).split("\n");
	let found = false;
	for (let i = 0; i < lines.length; i++) {
		const m = lines[i].match(ROW_RE);
		if (m && Number(m[1]) === phaseNum) {
			lines[i] = `| ${m[1].trim()} |${m[2]}| ${label} |${m[4]}|`;
			found = true;
			break;
		}
	}
	if (!found) {
		log.error(`Không thấy phase #${phaseNum} trong ${planFile}`);
		process.exitCode = 1;
		return;
	}
	await fs.writeFile(planFile, lines.join("\n"), "utf8");
	log.ok(`Phase #${phaseNum} -> ${label}`);
}

// In tiến độ tổng hợp.
export async function printStatus(planFile: string): Promise<void> {
	const lines = (await fs.readFile(planFile, "utf8")).split("\n");
	let done = 0;
	let active = 0;
	let pending = 0;
	const rows: string[] = [];
	for (const line of lines) {
		const m = line.match(ROW_RE);
		if (!m) continue;
		const statusCell = m[3].trim();
		if (statusCell.includes("xong")) done++;
		else if (statusCell.includes("đang")) active++;
		else pending++;
		rows.push(`  #${m[1].trim()} ${m[2].trim()} — ${statusCell}`);
	}
	const total = done + active + pending;
	log.plain(`Tiến độ: ${done}/${total} xong · ${active} đang làm · ${pending} chưa làm`);
	for (const r of rows) log.plain(r);
}
