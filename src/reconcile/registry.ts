// Đọc/ghi registry của Vit trong project: .claude/.vit/registry.json
// Registry lưu checksum nguồn + đích từng file lần cài trước (để phát hiện sửa tay).
import fs from "fs-extra";
import path from "node:path";
import { REGISTRY_FILE } from "../shared/config.js";
import type { Registry } from "./reconcile-types.js";

export function registryPath(projectRoot: string): string {
	return path.resolve(projectRoot, REGISTRY_FILE);
}

export async function readRegistry(projectRoot: string): Promise<Registry | null> {
	const p = registryPath(projectRoot);
	if (!(await fs.pathExists(p))) return null;
	try {
		return (await fs.readJson(p)) as Registry;
	} catch {
		return null;
	}
}

export async function writeRegistry(projectRoot: string, registry: Registry): Promise<void> {
	const p = registryPath(projectRoot);
	await fs.ensureDir(path.dirname(p));
	await fs.writeJson(p, registry, { spaces: 2 });
}
