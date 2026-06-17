// Giải nén tarball (.tar.gz) ra thư mục đích và định vị thư mục `claude/` bên trong.
import fs from "fs-extra";
import path from "node:path";
import * as tar from "tar";

// Ghi buffer tarball ra file tạm rồi giải nén vào destDir.
export async function extractTarball(buf: Buffer, destDir: string): Promise<void> {
	await fs.ensureDir(destDir);
	const tmpFile = path.join(destDir, "_archive.tar.gz");
	await fs.writeFile(tmpFile, buf);
	await tar.x({ file: tmpFile, cwd: destDir });
	await fs.remove(tmpFile);
}

// Tìm thư mục `claude/` (nhận diện bằng metadata.json) ở destDir hoặc lồng 1 cấp.
// Tarball release: claude/ ở gốc. Tarball repo GitHub: <owner>-<repo>-<sha>/claude/.
export async function findClaudeDir(destDir: string): Promise<string> {
	const direct = path.join(destDir, "claude");
	if (await isClaudeDir(direct)) return direct;

	for (const entry of await fs.readdir(destDir)) {
		const nested = path.join(destDir, entry, "claude");
		if (await isClaudeDir(nested)) return nested;
	}

	throw new Error("Không tìm thấy thư mục 'claude/' (kèm metadata.json) trong gói engine đã tải.");
}

// Tìm release-manifest.json đi kèm (nếu có) — release asset bundle sẵn manifest.
export async function findBundledManifest(destDir: string): Promise<string | null> {
	const direct = path.join(destDir, "release-manifest.json");
	if (await fs.pathExists(direct)) return direct;

	for (const entry of await fs.readdir(destDir)) {
		const nested = path.join(destDir, entry, "release-manifest.json");
		if (await fs.pathExists(nested)) return nested;
	}
	return null;
}

async function isClaudeDir(dir: string): Promise<boolean> {
	return (await fs.pathExists(dir)) && (await fs.pathExists(path.join(dir, "metadata.json")));
}
