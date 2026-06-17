// Router lệnh `vit plan <action>`: create | check | uncheck | status
import path from "node:path";
import { log } from "../../shared/logger.js";
import { scaffoldPlan } from "./plan-scaffold.js";
import { printStatus, resolvePlanFile, setPhaseStatus } from "./plan-status.js";

export interface PlanOptions {
	title?: string;
	phases?: string;
	dir?: string;
	start?: boolean;
}

export async function runPlan(action: string | undefined, target: string | undefined, options: PlanOptions): Promise<void> {
	try {
		switch (action) {
			case "create":
				return await handleCreate(options);
			case "check":
				return await handleCheck(target, options, false);
			case "uncheck":
				return await handleCheck(target, options, true);
			case "status":
				return await handleStatus(target);
			default:
				log.error("Dùng: vit plan <create|check|uncheck|status>");
				process.exitCode = 1;
		}
	} catch (err) {
		log.error(err instanceof Error ? err.message : String(err));
		process.exitCode = 1;
	}
}

async function handleCreate(options: PlanOptions): Promise<void> {
	if (!options.title) return fail("--title là bắt buộc cho create");
	if (!options.phases) return fail("--phases là bắt buộc (danh sách ngăn cách dấu phẩy)");
	const phases = options.phases.split(",").map((s) => s.trim()).filter(Boolean);
	if (phases.length === 0) return fail("Cần ít nhất 1 phase");
	const dirSlug = options.dir ?? options.title;
	const plansRoot = path.resolve(process.cwd(), "plans");
	await scaffoldPlan({ title: options.title, phases, dirSlug, plansRoot });
}

// target ở đây là số phase; plan.md lấy theo cwd (chạy trong thư mục plan) hoặc ./plan.md.
async function handleCheck(target: string | undefined, options: PlanOptions, uncheck: boolean): Promise<void> {
	const num = Number(target);
	if (!Number.isInteger(num) || num < 1) return fail("Cần số thứ tự phase, ví dụ: vit plan check 2");
	const planFile = resolvePlanFile();
	if (!planFile) return fail("Không thấy plan.md ở thư mục hiện tại. cd vào thư mục plan rồi chạy lại.");
	const status = uncheck ? "pending" : options.start ? "active" : "done";
	await setPhaseStatus(planFile, num, status);
}

async function handleStatus(target: string | undefined): Promise<void> {
	const planFile = resolvePlanFile(target);
	if (!planFile) return fail("Không thấy plan.md. Truyền đường dẫn: vit plan status <plan.md>");
	await printStatus(planFile);
}

function fail(msg: string): void {
	log.error(msg);
	process.exitCode = 1;
}
