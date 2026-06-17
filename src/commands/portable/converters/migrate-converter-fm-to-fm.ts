/**
 * Converter fm-to-fm — biến đổi frontmatter cho provider đích.
 * Trong vit-cli chỉ cần OpenCode (agents + commands).
 * Logic lấy từ claudekit-cli/converters/fm-to-fm.ts, giữ phần opencode.
 */
import type { ConversionResult, PortableItem } from "../migrate-types.js";

/** Map tool Claude Code → tool OpenCode */
const OPENCODE_TOOL_MAP: Record<string, string> = {
	Read: "read",
	Glob: "glob",
	Grep: "grep",
	Edit: "edit",
	Write: "write",
	MultiEdit: "patch",
	Bash: "bash",
	WebFetch: "webfetch",
	WebSearch: "websearch",
	NotebookEdit: "edit",
};

/** Thay .claude/ → .opencode/ trong nội dung */
function replaceClaudePathsOpenCode(content: string): string {
	return content.replace(/\.claude\//g, ".opencode/");
}

/** Chuyển agent Claude Code → định dạng agent OpenCode */
function convertOpenCodeAgent(item: PortableItem): ConversionResult {
	const warnings: string[] = [];
	const agentName = String(item.frontmatter.name ?? item.name);
	// brainstormer là primary, còn lại là subagent
	const mode = agentName === "brainstormer" ? "primary" : "subagent";

	// Map tools → object boolean
	let toolsObj: Record<string, boolean> | null = null;
	const toolsRaw = item.frontmatter.tools;
	if (typeof toolsRaw === "string" && toolsRaw.trim()) {
		const mapped = new Set<string>();
		for (const t of toolsRaw.split(",").map((s) => s.trim())) {
			const key = OPENCODE_TOOL_MAP[t];
			if (key) mapped.add(key);
		}
		if (mapped.size > 0) {
			toolsObj = {};
			for (const key of mapped) toolsObj[key] = true;
		}
	}

	const desc = (String(item.description || `Agent: ${agentName}`))
		.replace(/\n/g, " ")
		.trim()
		.slice(0, 200);

	const fmLines = ["---", `description: ${JSON.stringify(desc)}`, `mode: ${mode}`];
	if (toolsObj) {
		fmLines.push("tools:");
		for (const [k, v] of Object.entries(toolsObj)) fmLines.push(`  ${k}: ${v}`);
	}
	fmLines.push("---");

	const body = replaceClaudePathsOpenCode(item.body);
	return {
		content: `${fmLines.join("\n")}\n\n${body}\n`,
		filename: `${item.name}.md`,
		warnings,
	};
}

/** Chuyển command Claude Code → định dạng command OpenCode */
function convertOpenCodeCommand(item: PortableItem): ConversionResult {
	const desc = (String(item.description || `Command: ${item.name}`))
		.replace(/\n/g, " ")
		.trim()
		.slice(0, 200);

	const fmLines = ["---", `description: ${JSON.stringify(desc)}`];
	// Giữ agent field nếu có
	if (typeof item.frontmatter.agent === "string" && item.frontmatter.agent.trim()) {
		fmLines.push(`agent: ${JSON.stringify(item.frontmatter.agent)}`);
	}
	fmLines.push("---");

	const body = replaceClaudePathsOpenCode(item.body);
	return {
		content: `${fmLines.join("\n")}\n\n${body}\n`,
		filename: `${item.name}.md`,
		warnings: [],
	};
}

/** Converter fm-to-fm: điều phối theo loại item và provider */
export function convertFmToFm(item: PortableItem): ConversionResult {
	if (item.type === "command") return convertOpenCodeCommand(item);
	return convertOpenCodeAgent(item);
}
