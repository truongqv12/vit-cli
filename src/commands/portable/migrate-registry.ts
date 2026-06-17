/**
 * Registry theo dõi các item đã migrate — lưu tại .vit-migrate-registry.json trong project.
 * Dùng checksum SHA-256 của nội dung đích để phát hiện thay đổi và đảm bảo idempotent.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { MigrateRegistry, PortableType, ProviderType, RegistryEntry } from "./migrate-types.js";

const REGISTRY_FILENAME = ".vit-migrate-registry.json";

/** Trả về đường dẫn registry theo scope (project hoặc global) */
export function getRegistryPath(isGlobal: boolean): string {
	if (isGlobal) {
		const home = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
		return join(home, ".claude", REGISTRY_FILENAME);
	}
	return join(process.cwd(), REGISTRY_FILENAME);
}

/** Tính checksum SHA-256 của nội dung string */
export function computeChecksum(content: string): string {
	return createHash("sha256").update(content, "utf-8").digest("hex");
}

/** Đọc registry từ đĩa; trả về registry rỗng nếu chưa tồn tại */
export async function readRegistry(isGlobal: boolean): Promise<MigrateRegistry> {
	const path = getRegistryPath(isGlobal);
	if (!existsSync(path)) return { version: 1, entries: [] };
	try {
		const raw = await readFile(path, "utf-8");
		const parsed = JSON.parse(raw) as MigrateRegistry;
		if (!Array.isArray(parsed.entries)) parsed.entries = [];
		return parsed;
	} catch {
		return { version: 1, entries: [] };
	}
}

/** Ghi registry ra đĩa (atomic: ghi vào temp rồi rename không cần thiết trên Node) */
async function writeRegistry(registry: MigrateRegistry, isGlobal: boolean): Promise<void> {
	const path = getRegistryPath(isGlobal);
	await writeFile(path, JSON.stringify(registry, null, 2), "utf-8");
}

/** Tìm entry khớp item + type + provider + scope */
function findEntry(
	registry: MigrateRegistry,
	item: string,
	type: PortableType,
	provider: ProviderType,
	isGlobal: boolean,
): RegistryEntry | undefined {
	return registry.entries.find(
		(e) => e.item === item && e.type === type && e.provider === provider && e.global === isGlobal,
	);
}

/** Kiểm tra item có cần cài/cập nhật không dựa vào checksum nội dung đích */
export function needsInstall(
	registry: MigrateRegistry,
	item: string,
	type: PortableType,
	provider: ProviderType,
	isGlobal: boolean,
	newChecksum: string,
): "install" | "skip" | "update" {
	const entry = findEntry(registry, item, type, provider, isGlobal);
	if (!entry) return "install";
	// Đích biến mất -> cài lại. (KHÔNG đọc nội dung file đích vì merge-single ghi
	// nhiều block vào 1 file dùng chung -> checksum toàn file không khớp checksum block.)
	if (!existsSync(entry.path)) return "install";
	// So checksum nội dung đã convert lần trước (đã lưu) với lần này -> idempotent mọi strategy.
	return entry.checksum === newChecksum ? "skip" : "update";
}

/** Cập nhật hoặc thêm entry sau khi cài thành công */
export async function upsertRegistryEntry(
	isGlobal: boolean,
	entry: RegistryEntry,
): Promise<void> {
	const registry = await readRegistry(isGlobal);
	const idx = registry.entries.findIndex(
		(e) =>
			e.item === entry.item &&
			e.type === entry.type &&
			e.provider === entry.provider &&
			e.global === entry.global,
	);
	if (idx >= 0) {
		registry.entries[idx] = entry;
	} else {
		registry.entries.push(entry);
	}
	await writeRegistry(registry, isGlobal);
}
