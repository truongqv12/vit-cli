// Scaffold thư mục plan: plans/<date>-<slug>/plan.md + phase-XX-*.md
import fs from "fs-extra";
import path from "node:path";
import { log } from "../../shared/logger.js";

export const STATUS_PENDING = "☐ chưa làm";
export const STATUS_ACTIVE = "▶ đang làm";
export const STATUS_DONE = "✅ xong";

export function slugify(text: string): string {
	return text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "") // bỏ dấu tiếng Việt
		.replace(/đ/g, "d")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
}

// YYMMDD-HHMM theo giờ địa phương (CLI chạy real-time).
function timestamp(): string {
	const d = new Date();
	const p = (n: number) => String(n).padStart(2, "0");
	return `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export interface CreatePlanInput {
	title: string;
	phases: string[];
	dirSlug: string;
	plansRoot: string; // thường <project>/plans
}

export async function scaffoldPlan(input: CreatePlanInput): Promise<{ planDir: string; planFile: string; phaseFiles: string[] }> {
	const dirName = `${timestamp()}-${slugify(input.dirSlug)}`;
	const planDir = path.join(input.plansRoot, dirName);
	await fs.ensureDir(planDir);

	const phaseFiles: string[] = [];
	const rows: string[] = [];
	for (let i = 0; i < input.phases.length; i++) {
		const num = String(i + 1).padStart(2, "0");
		const phaseSlug = slugify(input.phases[i]);
		const fileName = `phase-${num}-${phaseSlug}.md`;
		const filePath = path.join(planDir, fileName);
		await fs.writeFile(filePath, phaseStub(i + 1, input.phases[i]), "utf8");
		phaseFiles.push(filePath);
		rows.push(`| ${i + 1} | ${input.phases[i]} | ${STATUS_PENDING} | ${fileName} |`);
	}

	const planFile = path.join(planDir, "plan.md");
	await fs.writeFile(planFile, planOverview(input.title, rows), "utf8");

	log.ok(`Tạo plan: ${planDir}`);
	log.info(`  plan.md + ${phaseFiles.length} phase. Đọc hết các file trước khi soạn nội dung dài (Read-before-Write).`);
	return { planDir, planFile, phaseFiles };
}

function planOverview(title: string, rows: string[]): string {
	return `# ${title}

## Phases

| # | Phase | Trạng thái | File |
| --- | --- | --- | --- |
${rows.join("\n")}

> Cập nhật trạng thái bằng \`vit plan check <số> [--start]\` / \`vit plan uncheck <số>\`.
> Xem tiến độ: \`vit plan status\`.
`;
}

function phaseStub(num: number, name: string): string {
	return `# Phase ${String(num).padStart(2, "0")} — ${name}

## Tổng quan
- Ưu tiên:
- Mô tả:

## Yêu cầu

## Các bước
1.

## Todo
- [ ]

## Tiêu chí hoàn thành

## Rủi ro & giảm thiểu
`;
}
