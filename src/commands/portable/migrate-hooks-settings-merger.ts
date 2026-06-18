/**
 * Orchestrator đăng ký Codex hooks — gọi SAU khi đã copy file hook vào .codex/hooks/.
 *
 * Pipeline (chỉ Codex, bám claudekit-cli nhưng cắt nhánh generic/gemini):
 *   1. detectCodexCapabilities() — chạy `codex --version`, suy ra event/matcher hỗ trợ.
 *   2. Đọc mục `hooks` từ .claude/settings.json (nguồn sự thật).
 *   3. filterToInstalledHooks — chỉ giữ hook trỏ tới file đã cài.
 *   4. generateCodexHookWrappers — sinh wrapper hash + map thay thế command.
 *   5. convertClaudeHooksToCodex — drop event/matcher không hỗ trợ, rewrite path → wrapper.
 *   6. mergeHooksIntoSettings — ghi/merge vào .codex/hooks.json (atomic + dedup + self-heal).
 *   7. ensureCodexHooksFeatureFlag — bật [features] hooks = true trong .codex/config.toml.
 *
 * Mọi đường dẫn được caller (migrate-command) resolve sẵn và truyền vào → module không
 * phụ thuộc provider-registry, dễ test.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import {
	type CodexCapabilities,
	detectCodexCapabilities,
} from "./migrate-codex-capabilities.js";
import { ensureCodexHooksFeatureFlag } from "./migrate-codex-features-flag.js";
import { generateCodexHookWrappers } from "./migrate-codex-hook-wrapper.js";
import {
	commandReferencesInstalledAsset,
	dedupeWarnings,
	extractHookReferencesFromCommand,
	filterHooksForTarget,
	hookAssetBasename,
	isCodexSupportedHookEvent,
	isExcludedHookAsset,
	normalizeHookAssetPath,
} from "./migrate-hook-compatibility.js";
import type { MigrationWarning } from "./migrate-types.js";
import {
	type HookGroup,
	type HooksSection,
	convertClaudeHooksToCodex,
} from "./converters/migrate-converter-claude-to-codex-hooks.js";

// ─── Public API ──────────────────────────────────────────────────────────────

export interface MigrateCodexHooksOptions {
	/** Basename các file hook đã cài (vd: ["simplify-gate.cjs"]) */
	installedHookFiles: string[];
	/** Đường dẫn tuyệt đối các file hook đã cài trong .codex/hooks/ (để sinh wrapper) */
	installedHookAbsolutePaths: string[];
	/** Đường dẫn tuyệt đối .claude/settings.json (nguồn) */
	claudeSettingsPath: string;
	/** Đường dẫn tuyệt đối .codex/hooks.json (đích) */
	hooksJsonPath: string;
	/** Đường dẫn tuyệt đối .codex/config.toml (để bật features flag) */
	configTomlPath: string;
	/** Thư mục hook đích (.codex/hooks, đã resolve) — để rewrite path */
	targetHooksDir: string;
	/** Thư mục hook nguồn (.claude/hooks, đã resolve) — để rewrite path */
	sourceHooksDir: string;
	/** Cài global hay project scope */
	global: boolean;
}

export type CodexHooksMigrationStatus =
	| "registered"
	| "no-installed-files"
	| "source-settings-missing"
	| "source-hooks-missing"
	| "source-settings-invalid"
	| "no-matching-hooks"
	| "merge-failed";

export interface MigrateCodexHooksResult {
	status: CodexHooksMigrationStatus;
	success: boolean;
	hooksRegistered: number;
	backupPath: string | null;
	hooksPruned?: number;
	warnings?: MigrationWarning[];
	wrapperPaths?: string[];
	capabilitiesVersion?: string;
	featureFlagWritten?: boolean;
	message?: string;
	error?: string;
	sourceSettingsPath: string | null;
	targetSettingsPath: string | null;
}

const CODEX_WRAPPABLE_HOOK_EXTENSIONS = new Set([".js", ".cjs", ".mjs", ".ts"]);

function isCodexWrappableHookPath(filePath: string): boolean {
	return (
		hookAssetBasename(filePath) !== "node-hook-runner.sh" &&
		CODEX_WRAPPABLE_HOOK_EXTENSIONS.has(extname(filePath).toLowerCase())
	);
}

/**
 * Orchestrator chính cho Codex hooks. Caller phải resolve sẵn mọi path.
 */
export async function migrateCodexHooksSettings(
	options: MigrateCodexHooksOptions,
): Promise<MigrateCodexHooksResult> {
	const {
		installedHookFiles,
		installedHookAbsolutePaths,
		claudeSettingsPath,
		hooksJsonPath,
		configTomlPath,
		targetHooksDir,
		sourceHooksDir,
		global: isGlobal,
	} = options;

	if (installedHookFiles.length === 0) {
		return {
			status: "no-installed-files",
			success: true,
			hooksRegistered: 0,
			backupPath: null,
			sourceSettingsPath: null,
			targetSettingsPath: null,
		};
	}

	// Bước 1: phát hiện capability Codex
	const capabilities = await detectCodexCapabilities();

	// Bước 2: đọc hook nguồn
	const sourceHooksResult = await inspectHooksSettings(claudeSettingsPath);
	if (sourceHooksResult.status === "missing-file") {
		return {
			status: "source-settings-missing",
			success: true,
			hooksRegistered: 0,
			backupPath: null,
			message: `Đã copy file hook nhưng không thấy đăng ký hook tại ${claudeSettingsPath}; ${hooksJsonPath} chưa được cập nhật.`,
			sourceSettingsPath: claudeSettingsPath,
			targetSettingsPath: hooksJsonPath,
			capabilitiesVersion: capabilities.version,
		};
	}
	if (sourceHooksResult.status === "missing-hooks") {
		return {
			status: "source-hooks-missing",
			success: true,
			hooksRegistered: 0,
			backupPath: null,
			message: `Đã copy file hook nhưng ${claudeSettingsPath} không có mục hooks; ${hooksJsonPath} chưa được cập nhật.`,
			sourceSettingsPath: claudeSettingsPath,
			targetSettingsPath: hooksJsonPath,
			capabilitiesVersion: capabilities.version,
		};
	}
	if (sourceHooksResult.status === "invalid-json" || !sourceHooksResult.hooks) {
		return {
			status: "source-settings-invalid",
			success: false,
			hooksRegistered: 0,
			backupPath: null,
			error: `Không đọc được đăng ký hook từ ${claudeSettingsPath}: ${sourceHooksResult.error ?? "JSON không hợp lệ"}.`,
			sourceSettingsPath: claudeSettingsPath,
			targetSettingsPath: hooksJsonPath,
			capabilitiesVersion: capabilities.version,
		};
	}

	const sourceHooks = sourceHooksResult.hooks;

	// Bước 3: lọc theo file đã cài
	const warnings: MigrationWarning[] = [];
	const filtered = filterToInstalledHooks(sourceHooks, installedHookFiles, warnings);

	// Bước 4: sinh wrapper + map thay thế command (per-file substitution thắng dir rewrite)
	const wrapperPaths: string[] = [];
	const commandSubstitutions = new Map<string, string>();
	if (installedHookAbsolutePaths.length > 0 && targetHooksDir) {
		const wrappable = installedHookAbsolutePaths.filter(isCodexWrappableHookPath);
		const wrapperResults = generateCodexHookWrappers(wrappable, targetHooksDir, capabilities);
		for (const wr of wrapperResults) {
			if (!wr.success) continue;
			wrapperPaths.push(wr.wrapperPath);
			const addKey = (p: string) => commandSubstitutions.set(p, wr.wrapperPath);
			const base = basename(wr.originalPath);
			addKey(wr.originalPath); // dạng target (installer trả về)
			if (targetHooksDir) {
				addKey(join(targetHooksDir, base));
				addKey(`./${join(targetHooksDir, base)}`);
			}
			if (sourceHooksDir) {
				addKey(join(resolve(sourceHooksDir), base));
				addKey(join(sourceHooksDir, base));
				addKey(`./${join(sourceHooksDir, base)}`);
			}
		}
	}

	// Bước 5: convert qua transformer Codex
	let converted: HooksSection;
	if (!sourceHooksDir) {
		// Không có sourceHooksDir → bỏ path rewrite để tránh thay thế thảm hoạ "/" → target
		converted = convertClaudeHooksToCodex(filtered, capabilities);
	} else {
		const effectiveTargetDir = targetHooksDir || sourceHooksDir;
		converted = convertClaudeHooksToCodex(filtered, capabilities, {
			sourceDir: sourceHooksDir,
			targetDir: effectiveTargetDir,
			commandSubstitutions: commandSubstitutions.size > 0 ? commandSubstitutions : undefined,
		});
	}

	const hooksRegistered = countHooks(converted);
	if (hooksRegistered === 0) {
		return {
			status: "no-matching-hooks",
			success: true,
			hooksRegistered: 0,
			backupPath: null,
			message: `Đã copy file hook nhưng không hook nào qua được bộ lọc tương thích Codex (event/matcher không hỗ trợ bị loại). ${hooksJsonPath} chưa được cập nhật.`,
			warnings: dedupeWarnings(warnings),
			sourceSettingsPath: claudeSettingsPath,
			targetSettingsPath: hooksJsonPath,
			capabilitiesVersion: capabilities.version,
		};
	}

	// Bước 6: merge vào hooks.json
	let backupPath: string | null = null;
	let hooksPruned = 0;
	try {
		const mergeResult = await mergeHooksIntoSettings(hooksJsonPath, converted, targetHooksDir);
		backupPath = mergeResult.backupPath;
		hooksPruned = mergeResult.hooksPruned;
	} catch (err) {
		return {
			status: "merge-failed",
			success: false,
			hooksRegistered: 0,
			backupPath: null,
			error: `Không ghi được đăng ký hook Codex vào ${hooksJsonPath}: ${err instanceof Error ? err.message : String(err)}`,
			sourceSettingsPath: claudeSettingsPath,
			targetSettingsPath: hooksJsonPath,
			capabilitiesVersion: capabilities.version,
		};
	}

	// Bước 7: bật [features] hooks = true
	let featureFlagWritten = false;
	if (capabilities.requiresFeatureFlag) {
		const flagResult = await ensureCodexHooksFeatureFlag(configTomlPath, isGlobal);
		featureFlagWritten = flagResult.status === "written" || flagResult.status === "updated";
	}

	return {
		status: "registered",
		success: true,
		hooksRegistered,
		backupPath,
		hooksPruned,
		warnings: dedupeWarnings(warnings),
		wrapperPaths: wrapperPaths.length > 0 ? wrapperPaths : undefined,
		capabilitiesVersion: capabilities.version,
		featureFlagWritten,
		sourceSettingsPath: claudeSettingsPath,
		targetSettingsPath: hooksJsonPath,
	};
}

// ─── Đọc + validate hooks từ settings.json ──────────────────────────────────

type HooksSettingsReadStatus = "ok" | "missing-file" | "invalid-json" | "missing-hooks";
interface HooksSettingsReadResult {
	status: HooksSettingsReadStatus;
	hooks?: HooksSection;
	error?: string;
}

/** Đọc mục hooks từ một file settings.json. Trả null nếu thiếu/không đọc được. */
export async function readHooksFromSettings(settingsPath: string): Promise<HooksSection | null> {
	const result = await inspectHooksSettings(settingsPath);
	return result.status === "ok" ? (result.hooks ?? null) : null;
}

function validateHooksSectionShape(value: unknown): string | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return "hooks phải là object khác null";
	}
	for (const [event, groups] of Object.entries(value as Record<string, unknown>)) {
		if (!Array.isArray(groups)) return `hooks.${event} phải là mảng group`;
		for (const group of groups as unknown[]) {
			if (!group || typeof group !== "object" || Array.isArray(group)) {
				return `hooks.${event} chứa group không phải object`;
			}
			const g = group as Record<string, unknown>;
			if (!Array.isArray(g.hooks)) return `hooks.${event}[].hooks phải là mảng`;
			for (const entry of g.hooks as unknown[]) {
				if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
					return `hooks.${event}[].hooks chứa entry không phải object`;
				}
				const e = entry as Record<string, unknown>;
				if (typeof e.type !== "string") return `hooks.${event}[].hooks[].type phải là string`;
				if (typeof e.command !== "string") return `hooks.${event}[].hooks[].command phải là string`;
			}
		}
	}
	return null;
}

async function inspectHooksSettings(settingsPath: string): Promise<HooksSettingsReadResult> {
	try {
		if (!existsSync(settingsPath)) return { status: "missing-file" };
		const raw = await readFile(settingsPath, "utf8");
		const parsed = JSON.parse(raw) as { hooks?: unknown };
		if (!parsed.hooks || typeof parsed.hooks !== "object") return { status: "missing-hooks" };
		const shapeError = validateHooksSectionShape(parsed.hooks);
		if (shapeError) {
			return { status: "invalid-json", error: `mục hooks có cấu trúc lạ: ${shapeError}` };
		}
		return { status: "ok", hooks: parsed.hooks as HooksSection };
	} catch (error) {
		return { status: "invalid-json", error: error instanceof Error ? error.message : String(error) };
	}
}

// ─── Lọc hook theo file đã cài ───────────────────────────────────────────────

function filterToInstalledHooks(
	hooks: HooksSection,
	installedFiles: string[],
	warnings: MigrationWarning[],
): HooksSection {
	// Codex: dùng filterHooksForTarget (lọc event không hỗ trợ + tham chiếu file)
	const result = filterHooksForTarget(hooks, installedFiles, "codex");
	warnings.push(...result.warnings);

	// Lọc thêm theo file thực sự đã cài (bám command → asset)
	const installedSet = new Set(installedFiles.map(normalizeHookAssetPath));
	for (const file of installedFiles) installedSet.add(hookAssetBasename(file));

	const filtered: HooksSection = {};
	for (const [event, groups] of Object.entries(result.hooks)) {
		const keptGroups: HookGroup[] = [];
		for (const group of groups) {
			const matching = group.hooks.filter((entry) =>
				commandReferencesInstalledAsset(entry.command, installedSet),
			);
			if (matching.length > 0) keptGroups.push({ ...group, hooks: matching });
		}
		if (keptGroups.length > 0) filtered[event] = keptGroups;
	}
	return filtered;
}

// ─── Merge vào hooks.json (atomic + dedup + self-heal) ───────────────────────

async function mergeHooksIntoSettings(
	targetSettingsPath: string,
	newHooks: HooksSection,
	targetHooksDir: string,
): Promise<{ backupPath: string | null; hooksPruned: number }> {
	let existingSettings: Record<string, unknown> = {};
	let backupPath: string | null = null;

	if (existsSync(targetSettingsPath)) {
		const raw = await readFile(targetSettingsPath, "utf8");
		try {
			existingSettings = JSON.parse(raw);
		} catch {
			existingSettings = {};
		}
		const stamp = isoStamp();
		backupPath = `${targetSettingsPath}.${stamp}.bak`;
		try {
			await writeFile(backupPath, raw, "utf8");
		} catch {
			backupPath = null;
		}
	} else if (Object.keys(newHooks).length === 0) {
		return { backupPath: null, hooksPruned: 0 };
	}

	const existingHooks = (existingSettings.hooks ?? {}) as HooksSection;
	const incompatibleCleanup = pruneIncompatibleHookRegistrations(existingHooks, targetHooksDir);
	const pruned = pruneStaleFileHooks(incompatibleCleanup.hooks);
	const merged = deduplicateMerge(pruned, newHooks);
	existingSettings.hooks = merged;

	const dir = dirname(targetSettingsPath);
	await mkdir(dir, { recursive: true });
	const tempPath = `${targetSettingsPath}.tmp`;
	try {
		await writeFile(tempPath, JSON.stringify(existingSettings, null, 2), "utf8");
		await rename(tempPath, targetSettingsPath);
	} catch (err) {
		await rm(tempPath, { force: true });
		throw new Error(`Ghi settings thất bại: ${err}. Backup giữ tại: ${backupPath}`);
	}
	return { backupPath, hooksPruned: incompatibleCleanup.hooksPruned };
}

/** Stamp thời gian cho tên file backup — KHÔNG dùng Date.now (test thuần). */
function isoStamp(): string {
	try {
		return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
	} catch {
		return "backup";
	}
}

function pruneIncompatibleHookRegistrations(
	hooks: HooksSection,
	targetHooksDir: string,
): { hooks: HooksSection; hooksPruned: number } {
	const dir = targetHooksDir || ".codex/hooks";
	let hooksPruned = 0;
	const pruned: HooksSection = {};
	for (const [event, groups] of Object.entries(hooks)) {
		const keptGroups: HookGroup[] = [];
		for (const group of groups) {
			const keptHooks = group.hooks.filter((entry) => {
				const refs = extractHookReferencesFromCommand(entry.command);
				const targetOwned = commandTargetsHookDir(entry.command, dir);
				const incompatible =
					!isCodexSupportedHookEvent(event) || refs.some((ref) => isExcludedHookAsset(ref));
				if (targetOwned && incompatible) {
					hooksPruned += 1;
					return false;
				}
				return true;
			});
			if (keptHooks.length > 0) keptGroups.push({ ...group, hooks: keptHooks });
		}
		if (keptGroups.length > 0) pruned[event] = keptGroups;
	}
	return { hooks: pruned, hooksPruned };
}

function commandTargetsHookDir(command: string, targetHooksDir: string): boolean {
	const cmd = command.replace(/\\/g, "/");
	const dir = targetHooksDir.replace(/\\/g, "/").replace(/\/+$/, "");
	return (
		cmd.includes(`${dir}/`) ||
		cmd.includes("$HOME/.codex/hooks/") ||
		cmd.includes("~/.codex/hooks/")
	);
}

function isCkManagedHookPath(absPath: string): boolean {
	const n = absPath.replace(/\\/g, "/");
	return (
		n.includes("/.claude/hooks/") ||
		n.includes("/.codex/hooks/") ||
		n.includes("/.gemini/hooks/")
	);
}

function extractAbsolutePaths(command: string): string[] {
	const matches: string[] = [];
	// Bắt cả path POSIX (/...) lẫn Windows drive (C:/... hoặc C:\...).
	// Command thực tế ghi vào hooks.json trên Windows là `node "C:/.../hook.cjs"`
	// — không có "/" dẫn đầu — nên regex POSIX-only sẽ bỏ sót và prune chết câm.
	const pathPattern = /(?:^|[\s"'(])([A-Za-z]:[\\/][^\s"'()]+|\/[^\s"'()]+)/g;
	let match = pathPattern.exec(command);
	while (match !== null) {
		matches.push(match[1]);
		match = pathPattern.exec(command);
	}
	return matches;
}

function pruneStaleFileHooks(existing: HooksSection): HooksSection {
	const result: HooksSection = {};
	for (const [event, groups] of Object.entries(existing)) {
		const prunedGroups: HookGroup[] = [];
		for (const group of groups) {
			const surviving = group.hooks.filter((h) => {
				const paths = extractAbsolutePaths(h.command);
				const ckPaths = paths.filter(isCkManagedHookPath);
				if (ckPaths.length === 0) return true;
				return ckPaths.some((p) => existsSync(p));
			});
			if (surviving.length > 0) prunedGroups.push({ ...group, hooks: surviving });
		}
		if (prunedGroups.length > 0) result[event] = prunedGroups;
	}
	return result;
}

function deduplicateMerge(existing: HooksSection, incoming: HooksSection): HooksSection {
	const merged: HooksSection = {};
	for (const [event, groups] of Object.entries(existing)) {
		merged[event] = groups.map((g) => ({ ...g, hooks: [...g.hooks] }));
	}
	for (const [event, incomingGroups] of Object.entries(incoming)) {
		const existingGroups = merged[event] ?? [];
		for (const incomingGroup of incomingGroups) {
			const matcherKey = incomingGroup.matcher ?? "";
			const existingGroup = existingGroups.find((g) => (g.matcher ?? "") === matcherKey);
			if (existingGroup) {
				const existingCommands = new Set(existingGroup.hooks.map((h) => h.command));
				for (const hook of incomingGroup.hooks) {
					if (!existingCommands.has(hook.command)) existingGroup.hooks.push(hook);
				}
			} else {
				existingGroups.push(incomingGroup);
			}
		}
		merged[event] = existingGroups;
	}
	return merged;
}

function countHooks(hooks: HooksSection): number {
	let n = 0;
	for (const groups of Object.values(hooks)) {
		for (const group of groups) n += group.hooks.length;
	}
	return n;
}
