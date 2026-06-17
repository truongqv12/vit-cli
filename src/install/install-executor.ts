// Executor — phần I/O của reconcile: dựng trạng thái đích, gọi reconciler thuần,
// áp plan (copy/backup/xoá), ghi registry. Dùng chung cho `vit init` và `vit update`.
// Hỗ trợ 2 vùng đích: "claude" -> .claude/ ; "root" -> project root.
import fs from "fs-extra";
import path from "node:path";
import { BACKUP_DIR, RUNTIME_DIR } from "../shared/config.js";
import { withRetry } from "../shared/fs-retry.js";
import { log } from "../shared/logger.js";
import { safeResolve } from "../shared/path-safety.js";
import { fileChecksum } from "../reconcile/checksum.js";
import { reconcile } from "../reconcile/reconciler.js";
import { readRegistry, writeRegistry } from "../reconcile/registry.js";
import { manifestKey } from "../reconcile/reconcile-types.js";
import type { EngineManifest, FileArea, Registry, ReconcileAction, TargetState } from "../reconcile/reconcile-types.js";
import { processSettings } from "./settings/settings-processor.js";
import { createProgress, printPanel } from "../shared/ui/ui.js";

// settings.json xử lý riêng bằng merge (giữ cấu hình user + hook), KHÔNG copy phẳng.
const SETTINGS_REL = "settings.json";
// Backup file vùng root gom vào .claude/.vit/backups/__root__/ để không rải ra project-root user.
const ROOT_BACKUP_PREFIX = "__root__";

export interface ExecuteOptions {
	force?: boolean;
	dryRun?: boolean;
}

export interface ExecuteResult {
	installed: number;
	updated: number;
	skipped: number;
	deleted: number;
	conflicts: string[];
	failures: string[];
}

// Đọc deletions[] từ engine (metadata.json đã tải).
export async function readDeletions(engineDir: string): Promise<string[]> {
	const metaPath = path.join(engineDir, "metadata.json");
	if (!(await fs.pathExists(metaPath))) return [];
	try {
		const meta = (await fs.readJson(metaPath)) as { deletions?: string[] };
		return meta.deletions ?? [];
	} catch {
		return [];
	}
}

export async function executeInstall(
	projectRoot: string,
	engineDir: string,
	rootDir: string | null,
	manifest: EngineManifest,
	options: ExecuteOptions,
): Promise<ExecuteResult> {
	const runtimeRoot = path.resolve(projectRoot, RUNTIME_DIR);
	const registry = await readRegistry(projectRoot);
	// settings.json xử lý riêng — không để lọt vào deletions (tránh delete↔re-create flip-flop).
	const deletions = (await readDeletions(engineDir)).filter((d) => d !== SETTINGS_REL);

	// Base đích/nguồn/backup theo vùng. area=root PHẢI dùng projectRoot (không runtimeRoot),
	// nếu không safeResolve sẽ ném vì path thoát khỏi .claude/.
	const targetBase = (area?: FileArea) => (area === "root" ? projectRoot : runtimeRoot);
	const sourceBase = (area?: FileArea) => (area === "root" ? rootDir : engineDir);
	const backupBase = (area?: FileArea) =>
		area === "root"
			? path.join(path.resolve(projectRoot, BACKUP_DIR), ROOT_BACKUP_PREFIX)
			: path.resolve(projectRoot, BACKUP_DIR);

	// Loại settings.json (merge riêng) và — nếu thiếu payload root — bỏ luôn file vùng root.
	const droppedRoot = !rootDir && manifest.files.some((f) => f.area === "root" && f.path !== SETTINGS_REL);
	const reconcileManifest: EngineManifest = {
		...manifest,
		files: manifest.files.filter((f) => f.path !== SETTINGS_REL && (f.area !== "root" || !!rootDir)),
	};
	if (droppedRoot) {
		log.info("Gói engine chưa có payload 'root/' — bỏ qua file project-root (cần release engine mới).");
	}

	// Dựng trạng thái đích hiện tại cho mọi khoá liên quan (theo vùng).
	const targetState: TargetState = {};
	for (const f of reconcileManifest.files) {
		const key = manifestKey(f.area, f.path);
		targetState[key] = await fileChecksum(safeResolve(targetBase(f.area), f.path));
	}
	// deletions là vùng claude (path claude-relative) -> khoá trần.
	for (const del of deletions) {
		if (!(del in targetState)) targetState[del] = await fileChecksum(safeResolve(runtimeRoot, del));
	}

	const plan = reconcile({
		manifest: reconcileManifest,
		registry,
		targetState,
		deletions,
		force: !!options.force,
	});

	if (options.dryRun) {
		printPlan(plan.actions);
		await processSettings({ engineDir, projectRoot, dryRun: true });
		return countResult(plan.actions, []);
	}

	const srcChecksumOf = new Map(reconcileManifest.files.map((f) => [manifestKey(f.area, f.path), f.checksum]));
	const newRegistry: Registry = { engineVersion: manifest.version, files: { ...(registry?.files ?? {}) } };
	const failures: string[] = [];

	// Progress bar X/Y cho vòng áp file — chỉ bật khi không dryRun và có action thực
	const total = plan.actions.length;
	const progress = total > 0 ? createProgress("Áp file", total) : null;

	// Áp từng action độc lập: lỗi 1 file không làm hỏng cả lượt; registry luôn được ghi cuối.
	let actionIdx = 0;
	for (const action of plan.actions) {
		try {
			const area = action.area;
			const key = manifestKey(area, action.path);
			const target = safeResolve(targetBase(area), action.path);
			const srcRoot = sourceBase(area);
			const source = srcRoot ? path.join(srcRoot, action.path) : null;
			const src = srcChecksumOf.get(key);

			if (action.type === "install" || action.type === "update") {
				if (!source || !(await fs.pathExists(source))) {
					failures.push(`${action.path}: thiếu file nguồn trong payload`);
					continue;
				}
				if (await fs.pathExists(target)) await backup(backupBase(area), targetBase(area), action.path);
				await fs.ensureDir(path.dirname(target));
				await withRetry(() => fs.copy(source, target, { overwrite: true }));
				if (src) newRegistry.files[key] = { sourceChecksum: src, targetChecksum: src };
			} else if (action.type === "delete") {
				if (await fs.pathExists(target)) await backup(backupBase(area), targetBase(area), action.path);
				await withRetry(() => fs.remove(target));
				delete newRegistry.files[key];
			} else if (action.type === "skip" || action.type === "conflict") {
				// File engine: ghi entry phản ánh thực tế (nguồn hiện tại + đích hiện tại).
				// Path deletions (không có trong manifest) -> src undefined -> giữ entry cũ.
				if (src) {
					newRegistry.files[key] = {
						sourceChecksum: src,
						targetChecksum: targetState[key] ?? src,
					};
				}
			}
		} catch (err) {
			failures.push(`${action.path}: ${err instanceof Error ? err.message : String(err)}`);
		}

		// Cập nhật progress sau mỗi action (kể cả skip/conflict — vẫn đã xử lý xong)
		progress?.update(++actionIdx);
	}

	// Kết thúc progress bar — in dòng hoàn thành
	progress?.done();

	await writeRegistry(projectRoot, newRegistry);

	// settings.json: merge engine vào bản user + prune hook chết (sau khi file hook đã vào .claude/).
	await processSettings({ engineDir, projectRoot });

	const result = countResult(plan.actions, failures);
	printSummary(result);
	return result;
}

// Backup file đích vào backup store của vùng trước khi ghi đè/xoá.
async function backup(backupBaseDir: string, targetBaseDir: string, rel: string): Promise<void> {
	const src = safeResolve(targetBaseDir, rel);
	if (!(await fs.pathExists(src))) return;
	const dest = safeResolve(backupBaseDir, rel);
	await fs.ensureDir(path.dirname(dest));
	await fs.copy(src, dest, { overwrite: true });
}

function countResult(actions: ReconcileAction[], failures: string[]): ExecuteResult {
	return {
		installed: actions.filter((a) => a.type === "install").length,
		updated: actions.filter((a) => a.type === "update").length,
		skipped: actions.filter((a) => a.type === "skip").length,
		deleted: actions.filter((a) => a.type === "delete").length,
		conflicts: actions.filter((a) => a.type === "conflict").map((a) => a.path),
		failures,
	};
}

function printPlan(actions: ReconcileAction[]): void {
	log.plain("Kế hoạch (dry-run):");
	for (const a of actions) {
		if (a.type === "skip") continue;
		log.plain(`  [${a.type}] ${a.path} — ${a.reason}`);
	}
	printSummary(countResult(actions, []));
}

function printSummary(r: ExecuteResult): void {
	// Dòng tóm tắt số liệu — luôn hiển thị
	const statsLine = `cài ${r.installed}  cập nhật ${r.updated}  bỏ qua ${r.skipped}  xoá ${r.deleted}`;

	// Xây zone phụ nếu có conflict hoặc lỗi
	const extraZones: Array<{ label: string; lines: string[] }> = [];

	if (r.conflicts.length > 0) {
		extraZones.push({
			label: `CONFLICT (${r.conflicts.length}) — dùng --force để ghi đè`,
			lines: r.conflicts.map((c) => `  ${c}`),
		});
	}
	if (r.failures.length > 0) {
		extraZones.push({
			label: `LỖI (${r.failures.length}) — đã bỏ qua, registry vẫn ghi`,
			lines: r.failures.map((f) => `  ${f}`),
		});
	}

	printPanel({
		title: "Kết quả cài đặt",
		zones: [
			{ label: "TỔNG KẾT", lines: [statsLine] },
			...extraZones,
		],
	});
}
