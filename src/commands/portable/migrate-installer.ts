/**
 * Installer — ghi item đã convert ra đường dẫn provider đích.
 * Hỗ trợ: per-file, merge-single, single-file, codex-toml, skill directory.
 * Backup với prefix .vit-backup-<pid> khi đè file tồn tại.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import {
	cp,
	mkdir,
	readFile,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { convertItem } from "./converters/migrate-converter-index.js";
import { buildCodexConfigEntry } from "./converters/migrate-converter-codex-toml.js";
import { PROVIDERS } from "./migrate-provider-registry.js";
import {
	computeChecksum,
	needsInstall,
	readRegistry,
	upsertRegistryEntry,
} from "./migrate-registry.js";
import type {
	MigrateInstallResult,
	PortableItem,
	PortableType,
	ProviderType,
	RegistryEntry,
	SkillInfo,
} from "./migrate-types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Tạo thư mục cha nếu chưa tồn tại */
async function ensureDir(dirPath: string): Promise<void> {
	if (!existsSync(dirPath)) await mkdir(dirPath, { recursive: true });
}

/** Backup file đang tồn tại trước khi ghi đè */
async function backupIfExists(filePath: string): Promise<string | null> {
	if (!existsSync(filePath)) return null;
	const backup = `${filePath}.vit-backup-${process.pid}`;
	await rename(filePath, backup);
	return backup;
}

/** Xóa backup sau khi ghi thành công */
async function removeBackup(backupPath: string | null): Promise<void> {
	if (backupPath && existsSync(backupPath)) {
		await rm(backupPath, { recursive: true, force: true });
	}
}

// ─── Ghi file đơn ──────────────────────────────────────────────────────────

async function writeFileAtomic(
	filePath: string,
	content: string,
): Promise<{ overwritten: boolean }> {
	await ensureDir(dirname(filePath));
	const backup = await backupIfExists(filePath);
	try {
		await writeFile(filePath, content, "utf-8");
		await removeBackup(backup);
		return { overwritten: backup !== null };
	} catch (err) {
		// Khôi phục backup nếu ghi thất bại
		if (backup && existsSync(backup)) await rename(backup, filePath).catch(() => {});
		throw err;
	}
}

// ─── Merge-single (AGENTS.md / GEMINI.md) ─────────────────────────────────

/** Section header duy nhất để phân biệt nội dung đã merge */
function buildSectionHeader(itemName: string): string {
	return `<!-- vit:migrate:${itemName} -->`;
}

/**
 * Merge nội dung vào file đích theo chiến lược merge-single.
 * Nếu section của item đã tồn tại → update; chưa → append.
 */
async function mergeIntoSingleFile(
	filePath: string,
	itemName: string,
	newContent: string,
): Promise<{ overwritten: boolean }> {
	await ensureDir(dirname(filePath));

	const header = buildSectionHeader(itemName);
	const footer = `<!-- /vit:migrate:${itemName} -->`;
	const block = `${header}\n${newContent}\n${footer}`;

	let existing = "";
	if (existsSync(filePath)) {
		existing = await readFile(filePath, "utf-8");
	}

	const startIdx = existing.indexOf(header);
	const endIdx = existing.indexOf(footer);

	let updated: string;
	let overwritten = false;

	if (startIdx >= 0 && endIdx > startIdx) {
		// Cập nhật block đã có
		updated = existing.slice(0, startIdx) + block + existing.slice(endIdx + footer.length);
		overwritten = true;
	} else {
		// Append block mới
		updated = existing ? `${existing.trimEnd()}\n\n${block}\n` : `${block}\n`;
	}

	await writeFile(filePath, updated, "utf-8");
	return { overwritten };
}

// ─── Codex config.toml ─────────────────────────────────────────────────────

/** Merge entry [agents.X] vào .codex/config.toml */
async function mergeCodexConfigEntry(
	configTomlPath: string,
	agentName: string,
	description?: string,
): Promise<void> {
	await ensureDir(dirname(configTomlPath));

	const entry = buildCodexConfigEntry(agentName, description);
	let existing = "";
	if (existsSync(configTomlPath)) {
		existing = await readFile(configTomlPath, "utf-8");
	}

	// Kiểm tra entry đã có chưa (theo slug)
	const slugLine = entry.split("\n")[0]; // "[agents.xxx]"
	if (existing.includes(slugLine)) return; // Idempotent

	const updated = existing ? `${existing.trimEnd()}\n\n${entry}\n` : `${entry}\n`;
	await writeFile(configTomlPath, updated, "utf-8");
}

// ─── Cài đặt PortableItem ──────────────────────────────────────────────────

/** Cài một PortableItem cho một provider, trả về kết quả */
export async function installPortableItem(
	item: PortableItem,
	provider: ProviderType,
	portableType: PortableType,
	isGlobal: boolean,
	dryRun: boolean,
	force = false,
): Promise<MigrateInstallResult> {
	const providerConfig = PROVIDERS[provider];
	const typeKey = portableType === "agent"
		? "agents"
		: portableType === "rules"
			? "rules"
			: portableType === "hooks"
				? "hooks"
				: portableType === "config"
					? "config"
					: portableType === "command"
						? "commands"
						: "skills";

	const pathConfig = providerConfig[typeKey as keyof typeof providerConfig] as
		| { projectPath: string | null; globalPath: string | null; format: string; writeStrategy: string; fileExtension: string }
		| null;

	if (!pathConfig) {
		return {
			provider,
			providerDisplayName: providerConfig.displayName,
			success: true,
			path: "",
			itemName: item.name,
			portableType,
			skipped: true,
			skipReason: `${providerConfig.displayName} không hỗ trợ ${portableType}`,
		};
	}

	const basePath = isGlobal ? pathConfig.globalPath : pathConfig.projectPath;
	if (!basePath) {
		return {
			provider,
			providerDisplayName: providerConfig.displayName,
			success: true,
			path: "",
			itemName: item.name,
			portableType,
			skipped: true,
			skipReason: `${providerConfig.displayName} không hỗ trợ ${isGlobal ? "global" : "project"} ${portableType}`,
		};
	}

	// Convert item
	// biome-ignore lint/suspicious/noExplicitAny: format từ registry là string literal
	const converted = convertItem(item, pathConfig.format as any, provider);
	if (converted.error) {
		return {
			provider,
			providerDisplayName: providerConfig.displayName,
			success: false,
			path: "",
			itemName: item.name,
			portableType,
			error: converted.error,
			warnings: converted.warnings,
		};
	}

	// Xác định đường dẫn file đích
	const strategy = pathConfig.writeStrategy;
	let targetPath: string;

	if (strategy === "merge-single") {
		targetPath = basePath; // basePath là file đích (vd: AGENTS.md)
	} else if (strategy === "codex-toml") {
		targetPath = join(basePath, converted.filename);
	} else {
		// per-file, single-file
		targetPath = join(basePath, converted.filename);
	}

	// Kiểm tra cần cài không
	const registry = await readRegistry(isGlobal);
	const newChecksum = computeChecksum(converted.content);
	const decision = needsInstall(registry, item.name, portableType, provider, isGlobal, newChecksum);

	// force ép cài lại, bỏ qua so khớp checksum (vẫn ghi đè + backup như thường)
	if (decision === "skip" && !force) {
		return {
			provider,
			providerDisplayName: providerConfig.displayName,
			success: true,
			path: targetPath,
			itemName: item.name,
			portableType,
			skipped: true,
			skipReason: "Không thay đổi (checksum khớp)",
		};
	}

	if (dryRun) {
		return {
			provider,
			providerDisplayName: providerConfig.displayName,
			success: true,
			path: targetPath,
			itemName: item.name,
			portableType,
			warnings: converted.warnings.length > 0 ? converted.warnings : undefined,
		};
	}

	try {
		let overwritten = false;

		if (strategy === "merge-single") {
			const mergeResult = await mergeIntoSingleFile(targetPath, item.name, converted.content);
			overwritten = mergeResult.overwritten;
		} else if (strategy === "single-file") {
			const writeResult = await writeFileAtomic(targetPath, converted.content);
			overwritten = writeResult.overwritten;
		} else {
			// per-file, codex-toml
			const writeResult = await writeFileAtomic(targetPath, converted.content);
			overwritten = writeResult.overwritten;

			// codex-toml: cập nhật config.toml
			if (strategy === "codex-toml" && portableType === "agent") {
				const configTomlPath = isGlobal
					? join(
							process.env.HOME ?? process.env.USERPROFILE ?? homedir(),
							".codex/config.toml",
						)
					: ".codex/config.toml";
				await mergeCodexConfigEntry(configTomlPath, item.name, item.description);
			}
		}

		// Cập nhật registry
		const entry: RegistryEntry = {
			item: item.name,
			type: portableType,
			provider,
			global: isGlobal,
			path: targetPath,
			checksum: newChecksum,
			installedAt: new Date().toISOString(),
		};
		await upsertRegistryEntry(isGlobal, entry);

		return {
			provider,
			providerDisplayName: providerConfig.displayName,
			success: true,
			path: targetPath,
			itemName: item.name,
			portableType,
			overwritten,
			warnings: converted.warnings.length > 0 ? converted.warnings : undefined,
			// Đường tuyệt đối để pipeline Codex hooks sinh wrapper + rewrite path.
			installAbsolutePath: resolve(targetPath),
		};
	} catch (err) {
		return {
			provider,
			providerDisplayName: providerConfig.displayName,
			success: false,
			path: targetPath,
			itemName: item.name,
			portableType,
			error: err instanceof Error ? err.message : "Lỗi không xác định khi ghi file",
		};
	}
}

// ─── Cài đặt skill directory ───────────────────────────────────────────────

/** Cài một skill directory cho provider, backup khi đè */
export async function installSkillDirectory(
	skill: SkillInfo,
	provider: ProviderType,
	isGlobal: boolean,
	dryRun: boolean,
	force = false,
): Promise<MigrateInstallResult> {
	const providerConfig = PROVIDERS[provider];
	const skillConfig = providerConfig.skills;

	if (!skillConfig) {
		return {
			provider,
			providerDisplayName: providerConfig.displayName,
			success: true,
			path: "",
			itemName: skill.name,
			portableType: "skill",
			skipped: true,
			skipReason: `${providerConfig.displayName} không hỗ trợ skills`,
		};
	}

	const basePath = isGlobal ? skillConfig.globalPath : skillConfig.projectPath;
	if (!basePath) {
		return {
			provider,
			providerDisplayName: providerConfig.displayName,
			success: true,
			path: "",
			itemName: skill.name,
			portableType: "skill",
			skipped: true,
			skipReason: `${providerConfig.displayName} không hỗ trợ ${isGlobal ? "global" : "project"} skills`,
		};
	}

	const targetDir = join(basePath, skill.name);

	// Nguồn == đích (OpenCode trỏ skills về .claude/skills): so đường dẫn TUYỆT ĐỐI
	// (skill.path tuyệt đối, targetDir có thể tương đối) — case-insensitive trên Windows.
	const sourceAbs = resolve(skill.path);
	const targetAbs = resolve(targetDir);
	const sameLocation =
		process.platform === "win32"
			? sourceAbs.toLowerCase() === targetAbs.toLowerCase()
			: sourceAbs === targetAbs;
	if (sameLocation) {
		return {
			provider,
			providerDisplayName: providerConfig.displayName,
			success: true,
			path: targetDir,
			itemName: skill.name,
			portableType: "skill",
			skipped: true,
			skipReason: "Đã ở đúng vị trí nguồn",
		};
	}

	// Idempotent: checksum SKILL.md nguồn; nếu đích đã có + khớp registry -> skip.
	const skillMdPath = join(skill.path, "SKILL.md");
	const skillChecksum = existsSync(skillMdPath)
		? computeChecksum(readFileSync(skillMdPath, "utf-8"))
		: `dir:${skill.name}`;
	const skillRegistry = await readRegistry(isGlobal);
	const existingSkillEntry = skillRegistry.entries.find(
		(e) =>
			e.item === skill.name &&
			e.type === "skill" &&
			e.provider === provider &&
			e.global === isGlobal,
	);
	// force ép cài lại skill, bỏ qua so khớp checksum SKILL.md
	if (!force && existsSync(targetDir) && existingSkillEntry?.checksum === skillChecksum) {
		return {
			provider,
			providerDisplayName: providerConfig.displayName,
			success: true,
			path: targetDir,
			itemName: skill.name,
			portableType: "skill",
			skipped: true,
			skipReason: "Không thay đổi (checksum khớp)",
		};
	}

	if (dryRun) {
		return {
			provider,
			providerDisplayName: providerConfig.displayName,
			success: true,
			path: targetDir,
			itemName: skill.name,
			portableType: "skill",
		};
	}

	try {
		await ensureDir(basePath);
		const alreadyExists = existsSync(targetDir);
		let backupPath: string | null = null;

		if (alreadyExists) {
			backupPath = `${targetDir}.vit-backup-${process.pid}`;
			await rename(targetDir, backupPath);
		}

		try {
			await cp(skill.path, targetDir, { recursive: true, force: true });
		} catch (err) {
			// Rollback
			if (backupPath && existsSync(backupPath)) {
				await rename(backupPath, targetDir).catch(() => {});
			} else if (existsSync(targetDir)) {
				await rm(targetDir, { recursive: true, force: true }).catch(() => {});
			}
			throw err;
		}

		await removeBackup(backupPath);

		// Cập nhật registry
		const entry: RegistryEntry = {
			item: skill.name,
			type: "skill",
			provider,
			global: isGlobal,
			path: targetDir,
			checksum: skillChecksum,
			installedAt: new Date().toISOString(),
		};
		await upsertRegistryEntry(isGlobal, entry);

		return {
			provider,
			providerDisplayName: providerConfig.displayName,
			success: true,
			path: targetDir,
			itemName: skill.name,
			portableType: "skill",
			overwritten: alreadyExists,
			warnings: alreadyExists ? [`Đã ghi đè thư mục skill: ${skill.name}`] : undefined,
		};
	} catch (err) {
		return {
			provider,
			providerDisplayName: providerConfig.displayName,
			success: false,
			path: targetDir,
			itemName: skill.name,
			portableType: "skill",
			error: err instanceof Error ? err.message : "Lỗi không xác định khi copy skill",
		};
	}
}
