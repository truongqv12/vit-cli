/**
 * Converter md-strip — xóa các tham chiếu Claude-specific khỏi nội dung markdown.
 * Dùng cho config (CLAUDE.md → AGENTS.md/GEMINI.md) và rules của codex/opencode/antigravity.
 */
import type { ConversionResult, PortableItem, ProviderType } from "../migrate-types.js";

/** Thay thế tên tool Claude Code bằng mô tả chung */
const TOOL_REPLACEMENTS: Array<[RegExp, string]> = [
	[/\b(the\s+)?Read\s+tool\b/gi, "file reading"],
	[/\buse\s+Read\b/gi, "use file reading"],
	[/\b(the\s+)?Write\s+tool\b/gi, "file writing"],
	[/\b(the\s+)?Edit\s+tool\b/gi, "file editing"],
	[/\b(the\s+)?Bash\s+tool\b/gi, "terminal/shell"],
	[/\buse\s+Bash\b/gi, "use terminal/shell"],
	[/\b(the\s+)?Grep\s+tool\b/gi, "code search"],
	[/\b(the\s+)?Glob\s+tool\b/gi, "file search"],
	[/\b(the\s+)?Task\s+tool\b/gi, "subtask delegation"],
	[/\bWebFetch\b/g, "web access"],
	[/\bWebSearch\b/g, "web access"],
];

/** Map provider → đường dẫn thay thế cho .claude/ refs */
const PROVIDER_PATH_MAP: Partial<Record<ProviderType, string>> = {
	codex: "AGENTS.md",
	opencode: "AGENTS.md",
	antigravity: "GEMINI.md",
};

/** Kiểm tra vị trí pos có nằm trong code block không */
function buildCodeBlockChecker(content: string): (pos: number) => boolean {
	const ranges: Array<[number, number]> = [];
	for (const m of content.matchAll(/```[\s\S]*?```/g)) {
		if (m.index !== undefined) ranges.push([m.index, m.index + m[0].length]);
	}
	return (pos: number) => ranges.some(([s, e]) => pos >= s && pos < e);
}

/**
 * Xóa tham chiếu Claude-specific khỏi nội dung markdown.
 * Giữ nguyên nội dung trong code block.
 */
export function stripClaudeRefs(content: string, provider: ProviderType): string {
	const isInCode = buildCodeBlockChecker(content);
	let result = content;

	// 1. Thay tên tool
	for (const [regex, replacement] of TOOL_REPLACEMENTS) {
		result = result.replace(regex, (matched, ...args) => {
			const offset = args[args.length - 2] as number;
			return isInCode(offset) ? matched : replacement;
		});
	}

	// 2. Xóa slash command (trừ URL và path hệ thống)
	result = result.replace(/(?<!\w)(\/[a-z][a-z0-9/._:-]+)/g, (matched, ...args) => {
		const offset = args[args.length - 2] as number;
		if (isInCode(offset)) return matched;
		if (/\.\w+$/.test(matched)) return matched;
		if (/^\/(?:api|src|home|Users|var|etc|opt|tmp)\//.test(matched)) return matched;
		if ((matched.match(/\//g) ?? []).length >= 3) return matched;
		return "";
	});

	// 3. Thay .claude/ path refs
	result = result.replace(/\.claude\//g, (matched, ...args) => {
		const offset = args[args.length - 2] as number;
		if (isInCode(offset)) return matched;
		return PROVIDER_PATH_MAP[provider] ? `${PROVIDER_PATH_MAP[provider]}/` : matched;
	});

	// 4. Thay CLAUDE.md → tên config file của provider
	const configFile = PROVIDER_PATH_MAP[provider] ?? "AGENTS.md";
	result = result.replace(/\bCLAUDE\.md\b/g, (matched, ...args) => {
		const offset = args[args.length - 2] as number;
		return isInCode(offset) ? matched : configFile;
	});

	// 5. Dọn dẹp dòng trống thừa
	result = result.replace(/\n{3,}/g, "\n\n").trim();

	return result;
}

/** Converter md-strip: xóa Claude refs, trả về ConversionResult */
export function convertMdStrip(item: PortableItem, provider: ProviderType): ConversionResult {
	const stripped = stripClaudeRefs(item.body, provider);
	return {
		content: stripped,
		filename: `${item.name}.md`,
		warnings: stripped.length === 0 ? ["Toàn bộ nội dung là Claude-specific, kết quả rỗng"] : [],
	};
}
