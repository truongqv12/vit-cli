/**
 * Converter fm-to-codex-toml — chuyển Claude Code agent → Codex TOML multi-agent format.
 * Dựa trên claudekit-cli/converters/fm-to-codex-toml.ts (logic giữ nguyên, bỏ model-taxonomy).
 */
import { createHash } from "node:crypto";
import type { ConversionResult, PortableItem } from "../migrate-types.js";

const MAX_SLUG_LEN = 96;

/** Tạo hash ngắn 8 ký tự từ chuỗi */
function shortHash(value: string): string {
	return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

/** Chuyển tên agent (kebab-case) → slug snake_case cho TOML table key */
export function toCodexSlug(name: string): string {
	// biome-ignore lint/suspicious/noMisleadingCharacterClass: dải dấu kết hợp để loại bỏ dấu
	const normalized = name.normalize("NFKD").replace(/[̀-ͯ]/g, "");
	let slug = normalized
		.replace(/[^a-zA-Z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.toLowerCase();
	if (!slug) slug = `agent_${shortHash(name)}`;
	if (slug.length > MAX_SLUG_LEN) slug = slug.slice(0, MAX_SLUG_LEN).replace(/_+$/, "");
	if (!slug) return `agent_${shortHash(name)}`;
	return slug;
}

/** Escape chuỗi dùng trong TOML multiline (""") */
function escapeTomlMultiline(text: string): string {
	// TOML multiline: không escape backslash, chỉ cần tránh """ bên trong
	return text.replace(/"""/g, '""\\"');
}

/** Suy ra sandbox_mode từ chuỗi tools của frontmatter */
function deriveSandboxMode(tools: unknown): string | null {
	if (typeof tools !== "string" || !tools.trim()) return null;
	const toolList = tools
		.split(/[,;|]/)
		.map((t) => t.trim().toLowerCase().replace(/\(.*\)$/, ""))
		.filter(Boolean);
	const hasWrite = toolList.some((t) =>
		["bash", "write", "edit", "multiedit", "notebookedit", "apply_patch", "task"].includes(t),
	);
	const hasRead = toolList.some((t) => ["read", "grep", "glob", "ls", "search"].includes(t));
	if (hasWrite) return "workspace-write";
	if (hasRead) return "read-only";
	return null;
}

/** Chuyển Claude Code agent → nội dung file .toml của Codex */
export function convertFmToCodexToml(item: PortableItem): ConversionResult {
	const warnings: string[] = [];
	const slug = toCodexSlug(item.name);
	const lines: string[] = [];

	// Model: giữ nguyên nếu có (vit không có taxonomy, chỉ comment)
	const modelRaw = item.frontmatter.model;
	if (typeof modelRaw === "string" && modelRaw.trim() && modelRaw.trim() !== "inherit") {
		// Ghi comment để người dùng tự chỉnh — không map model vì không có taxonomy
		lines.push(`# model = ${JSON.stringify(modelRaw.trim())}  # chỉnh theo model Codex hỗ trợ`);
		warnings.push(`Model "${modelRaw}" không tự động map — hãy chỉnh thủ công trong ${slug}.toml`);
	}

	// Sandbox mode từ tools
	const sandboxMode = deriveSandboxMode(item.frontmatter.tools);
	if (sandboxMode) lines.push(`sandbox_mode = "${sandboxMode}"`);

	// Developer instructions
	const body = item.body.trim();
	if (!body) warnings.push(`Agent "${item.name}" không có body — developer_instructions rỗng`);
	if (lines.length > 0) lines.push("");
	lines.push(`developer_instructions = """\n${escapeTomlMultiline(body)}\n"""`);

	return {
		content: lines.join("\n"),
		filename: `${slug}.toml`,
		warnings,
	};
}

/** Tạo entry [agents.X] cho config.toml của Codex */
export function buildCodexConfigEntry(name: string, description?: string): string {
	const slug = toCodexSlug(name);
	const desc = description ?? name;
	return [
		`[agents.${slug}]`,
		`description = ${JSON.stringify(desc)}`,
		`config_file = "agents/${slug}.toml"`,
	].join("\n");
}
