/**
 * Converter command-to-codex-skill — chuyển Claude Code command → Codex skill SKILL.md.
 * Codex nhập command thành skill dưới .agents/skills/<name>/SKILL.md.
 */
import type { ConversionResult, PortableItem } from "../migrate-types.js";
import { toCodexSlug } from "./migrate-converter-codex-toml.js";

const MAX_SKILL_NAME_LEN = 64;
const MAX_SKILL_DESC_LEN = 200;

/** Lấy tên command từ segments hoặc name */
function getSourceCommandName(item: PortableItem): string {
	const segments =
		item.segments && item.segments.length > 0 ? item.segments : item.name.split("/");
	return segments.filter(Boolean).join("-");
}

/** Tên skill Codex từ segments (snake_case) */
function getSkillName(item: PortableItem): string {
	const segments =
		item.segments && item.segments.length > 0 ? item.segments : item.name.split("/");
	return toCodexSlug(segments.filter(Boolean).join("-"));
}

/** Đường dẫn file đích: <skillName>/SKILL.md */
function getSkillFilename(item: PortableItem): string {
	return `${getSkillName(item)}/SKILL.md`;
}

/** Kiểm tra command dùng cú pháp Claude-specific không hỗ trợ trong Codex */
function hasUnsupportedSyntax(body: string): boolean {
	return (
		body.includes("$ARGUMENTS") ||
		/\$[1-9]\d*/.test(body) ||
		(body.includes("{{") && body.includes("}}")) ||
		body.includes("!`")
	);
}

/** Converter command → Codex SKILL.md */
export function convertCommandToCodexSkill(item: PortableItem): ConversionResult {
	const skillName = getSkillName(item);
	const sourceName = getSourceCommandName(item);
	const filename = getSkillFilename(item);
	const warnings: string[] = [];

	const description = (item.description || `Migrated command ${sourceName}`)
		.replace(/\s+/g, " ")
		.trim();

	if (skillName.length > MAX_SKILL_NAME_LEN) {
		return {
			content: "",
			filename,
			warnings,
			error: `Tên skill Codex vượt quá ${MAX_SKILL_NAME_LEN} ký tự: "${skillName}"`,
		};
	}
	if (description.length > MAX_SKILL_DESC_LEN) {
		return {
			content: "",
			filename,
			warnings,
			error: `Mô tả skill Codex vượt quá ${MAX_SKILL_DESC_LEN} ký tự`,
		};
	}
	if (hasUnsupportedSyntax(item.body)) {
		warnings.push(
			"Command dùng cú pháp động Claude-specific ($ARGUMENTS, {{}}); đã cài như skill Codex để chỉnh thủ công.",
		);
	}

	const templateBody = item.body.trim() || "Không có nội dung command template.";
	const content = [
		"---",
		`name: ${JSON.stringify(skillName)}`,
		`description: ${JSON.stringify(description)}`,
		"---",
		"",
		`# ${skillName}`,
		"",
		`Dùng skill này khi người dùng yêu cầu chạy command \`${sourceName}\`.`,
		"",
		"## Command Template",
		"",
		templateBody,
		"",
	].join("\n");

	return { content, filename, warnings };
}
