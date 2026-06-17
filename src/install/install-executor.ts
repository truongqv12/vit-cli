// Executor — phần I/O của reconcile: dựng trạng thái đích, gọi reconciler thuần,
// áp plan (copy/backup/xoá), ghi registry. Dùng chung cho `vit init` và `vit update`.
import fs from "fs-extra";
import path from "node:path";
import { BACKUP_DIR, RUNTIME_DIR } from "../shared/config.js";
import { log } from "../shared/logger.js";
import { fileChecksum } from "../reconcile/checksum.js";
import { reconcile } from "../reconcile/reconciler.js";
import { readRegistry, writeRegistry } from "../reconcile/registry.js";
import type { EngineManifest, Registry, ReconcileAction, TargetState } from "../reconcile/reconcile-types.js";

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
	manifest: EngineManifest,
	options: ExecuteOptions,
): Promise<ExecuteResult> {
	const runtimeRoot = path.resolve(projectRoot, RUNTIME_DIR);
	const registry = await readRegistry(projectRoot);
	const deletions = await readDeletions(engineDir);

	// Dựng trạng thái đích hiện tại cho mọi path liên quan.
	const targetState: TargetState = {};
	const allPaths = new Set<string>([...manifest.files.map((f) => f.path), ...deletions]);
	for (const rel of allPaths) {
		targetState[rel] = await fileChecksum(path.join(runtimeRoot, rel));
	}

	const plan = reconcile({ manifest, registry, targetState, deletions, force: !!options.force });

	if (options.dryRun) {
		printPlan(plan.actions);
		return countResult(plan.actions);
	}

	const srcChecksumOf = new Map(manifest.files.map((f) => [f.path, f.checksum]));
	const newRegistry: Registry = { engineVersion: manifest.version, files: { ...(registry?.files ?? {}) } };

	for (const action of plan.actions) {
		const target = path.join(runtimeRoot, action.path);
		const source = path.join(engineDir, action.path);

		if (action.type === "install" || action.type === "update") {
			if (await fs.pathExists(target)) await backup(runtimeRoot, action.path);
			await fs.ensureDir(path.dirname(target));
			await fs.copy(source, target, { overwrite: true });
			const sum = srcChecksumOf.get(action.path) ?? "";
			newRegistry.files[action.path] = { sourceChecksum: sum, targetChecksum: sum };
		} else if (action.type === "delete") {
			await backup(runtimeRoot, action.path);
			await fs.remove(target);
			delete newRegistry.files[action.path];
		} else if (action.type === "skip") {
			// Giữ entry phản ánh thực tế (nguồn mới + đích hiện tại) nếu là file engine.
			const sum = srcChecksumOf.get(action.path);
			if (sum) {
				newRegistry.files[action.path] = {
					sourceChecksum: sum,
					targetChecksum: targetState[action.path] ?? sum,
				};
			}
		}
		// conflict: không đụng file, không đổi registry entry (giữ bản user).
	}

	await writeRegistry(projectRoot, newRegistry);
	const result = countResult(plan.actions);
	printSummary(result);
	return result;
}

async function backup(runtimeRoot: string, rel: string): Promise<void> {
	const src = path.join(runtimeRoot, rel);
	if (!(await fs.pathExists(src))) return;
	const dest = path.join(runtimeRoot, "..", BACKUP_DIR, rel);
	await fs.ensureDir(path.dirname(dest));
	await fs.copy(src, dest, { overwrite: true });
}

function countResult(actions: ReconcileAction[]): ExecuteResult {
	return {
		installed: actions.filter((a) => a.type === "install").length,
		updated: actions.filter((a) => a.type === "update").length,
		skipped: actions.filter((a) => a.type === "skip").length,
		deleted: actions.filter((a) => a.type === "delete").length,
		conflicts: actions.filter((a) => a.type === "conflict").map((a) => a.path),
	};
}

function printPlan(actions: ReconcileAction[]): void {
	log.plain("Kế hoạch (dry-run):");
	for (const a of actions) {
		if (a.type === "skip") continue;
		log.plain(`  [${a.type}] ${a.path} — ${a.reason}`);
	}
	printSummary(countResult(actions));
}

function printSummary(r: ExecuteResult): void {
	log.ok(`cài ${r.installed} · cập nhật ${r.updated} · bỏ qua ${r.skipped} · xoá ${r.deleted}`);
	if (r.conflicts.length > 0) {
		log.warn(`${r.conflicts.length} conflict (giữ bản bạn sửa). Dùng --force để ghi đè:`);
		for (const c of r.conflicts) log.plain(`  - ${c}`);
	}
}
