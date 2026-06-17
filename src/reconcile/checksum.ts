// Tính checksum SHA-256 — khớp cách engine sinh manifest (hash nội dung byte thô).
import { createHash } from "node:crypto";
import fs from "fs-extra";

export function contentChecksum(buf: Buffer | string): string {
	return createHash("sha256").update(buf).digest("hex");
}

export async function fileChecksum(filePath: string): Promise<string | null> {
	if (!(await fs.pathExists(filePath))) return null;
	const buf = await fs.readFile(filePath);
	return contentChecksum(buf);
}
