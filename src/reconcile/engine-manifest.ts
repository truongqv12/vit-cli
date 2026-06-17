// Nạp manifest engine: ưu tiên manifest đi kèm (release asset),
// fallback tự sinh bằng cách quét thư mục claude/ đã tải.
import fs from "fs-extra";
import path from "node:path";
import { contentChecksum } from "./checksum.js";
import type { EngineManifest, ManifestFile } from "./reconcile-types.js";

export async function loadOrSynthesizeManifest(
	engineDir: string,
	bundledManifestPath: string | null,
	version: string,
): Promise<EngineManifest> {
	if (bundledManifestPath && (await fs.pathExists(bundledManifestPath))) {
		const m = (await fs.readJson(bundledManifestPath)) as EngineManifest;
		if (Array.isArray(m.files) && m.files.length > 0) return m;
	}
	return synthesizeFromDir(engineDir, version);
}

// Quét đệ quy engineDir, sinh manifest (path tương đối + checksum + size).
async function synthesizeFromDir(engineDir: string, version: string): Promise<EngineManifest> {
	const files: ManifestFile[] = [];

	async function walk(dir: string): Promise<void> {
		for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name === "node_modules" || entry.name === ".git") continue;
				await walk(full);
			} else if (entry.isFile()) {
				const buf = await fs.readFile(full);
				const rel = path.relative(engineDir, full).replace(/\\/g, "/");
				files.push({ path: rel, checksum: contentChecksum(buf), size: buf.length });
			}
		}
	}

	await walk(engineDir);
	files.sort((a, b) => a.path.localeCompare(b.path));
	return { version, files };
}
