/**
 * Converter direct-copy — sao chép nội dung nguyên bản, chỉ thay thế .claude/ → thư mục config của provider.
 */
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import type { ConversionResult, PortableItem, ProviderType } from "../migrate-types.js";

/** Map provider → thư mục config tương ứng */
const PROVIDER_CONFIG_DIR: Partial<Record<ProviderType, string>> = {
	opencode: ".opencode/",
	antigravity: ".agent/",
	codex: ".codex/",
};

/** Thay .claude/ bằng thư mục config của provider đích */
function replaceClaudePaths(content: string, provider: ProviderType): string {
	const targetDir = PROVIDER_CONFIG_DIR[provider];
	if (!targetDir) return content;
	return content.replace(/\.claude\//g, targetDir);
}

/** Tạo tên file đích giữ nguyên namespace (vd: "docs/init" → "docs/init.md") */
function buildFilename(item: PortableItem, sourceExt: string): string {
	const namespacedName =
		item.segments && item.segments.length > 0
			? item.segments.join("/")
			: item.name.includes("/") ? item.name : item.name;

	if (sourceExt) {
		return namespacedName.toLowerCase().endsWith(sourceExt.toLowerCase())
			? namespacedName
			: `${namespacedName}${sourceExt}`;
	}
	return namespacedName.includes(".") ? namespacedName : `${namespacedName}.md`;
}

/** Converter direct-copy: đọc file gốc và thay path nếu cần */
export function convertDirectCopy(item: PortableItem, provider: ProviderType): ConversionResult {
	let content: string;
	try {
		content = readFileSync(item.sourcePath, "utf-8");
	} catch {
		// Fallback khi file không đọc được (vd: item tổng hợp trong test)
		content = item.body;
	}

	content = replaceClaudePaths(content, provider);
	const sourceExt = extname(item.sourcePath);
	const filename = buildFilename(item, sourceExt);

	return { content, filename, warnings: [] };
}
