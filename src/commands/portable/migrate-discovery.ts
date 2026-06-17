/**
 * Discovery — quét .claude/ của project để tìm agents, commands, skills, rules, hooks, config.
 * Trả về danh sách PortableItem và SkillInfo sẵn sàng để convert + install.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import type { ParsedFrontmatter, PortableItem, SkillInfo } from "./migrate-types.js";

// ─── Frontmatter parser ────────────────────────────────────────────────────

/**
 * Parse YAML frontmatter đơn giản (chỉ dùng nội bộ — không cần thư viện nặng).
 * Hỗ trợ: key: "value", key: value (string đơn), không hỗ trợ nested.
 */
function parseFrontmatter(content: string): { frontmatter: ParsedFrontmatter; body: string } {
	const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!fmMatch) {
		return { frontmatter: {}, body: content };
	}
	const raw = fmMatch[1];
	const body = fmMatch[2] ?? "";
	const frontmatter: ParsedFrontmatter = {};

	for (const line of raw.split("\n")) {
		const colonIdx = line.indexOf(":");
		if (colonIdx < 1) continue;
		const key = line.slice(0, colonIdx).trim();
		let value = line.slice(colonIdx + 1).trim();
		// Bỏ dấu ngoặc kép bao quanh nếu có
		if ((value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		frontmatter[key] = value;
	}

	return { frontmatter, body };
}

// ─── Hàm đọc file ──────────────────────────────────────────────────────────

function readMdFile(filePath: string): { frontmatter: ParsedFrontmatter; body: string } | null {
	try {
		const content = readFileSync(filePath, "utf-8");
		return parseFrontmatter(content);
	} catch {
		return null;
	}
}

// ─── Discovery từng loại ───────────────────────────────────────────────────

/** Quét thư mục .claude/agents/ → danh sách PortableItem */
export function discoverAgents(claudeDir: string): PortableItem[] {
	const agentsDir = join(claudeDir, "agents");
	if (!existsSync(agentsDir)) return [];
	const items: PortableItem[] = [];

	for (const entry of readdirSync(agentsDir, { withFileTypes: true })) {
		if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
		const filePath = join(agentsDir, entry.name);
		const parsed = readMdFile(filePath);
		if (!parsed) continue;
		const name = entry.name.replace(/\.md$/, "");
		items.push({
			name,
			description: String(parsed.frontmatter.description ?? `Agent: ${name}`),
			type: "agent",
			sourcePath: filePath,
			frontmatter: parsed.frontmatter,
			body: parsed.body,
		});
	}
	return items;
}

/** Quét .claude/commands/ → danh sách PortableItem (hỗ trợ nested) */
export function discoverCommands(claudeDir: string): PortableItem[] {
	const commandsDir = join(claudeDir, "commands");
	if (!existsSync(commandsDir)) return [];
	const items: PortableItem[] = [];

	function scanDir(dir: string, segments: string[]): void {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				scanDir(fullPath, [...segments, entry.name]);
				continue;
			}
			if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
			const parsed = readMdFile(fullPath);
			if (!parsed) continue;
			const nameParts = [...segments, entry.name.replace(/\.md$/, "")];
			const name = nameParts.join("/");
			items.push({
				name,
				description: String(parsed.frontmatter.description ?? `Command: ${name}`),
				type: "command",
				sourcePath: fullPath,
				frontmatter: parsed.frontmatter,
				body: parsed.body,
				segments: nameParts,
			});
		}
	}

	scanDir(commandsDir, []);
	return items;
}

/** Quét .claude/skills/ → danh sách SkillInfo (thư mục) */
export function discoverSkills(claudeDir: string): SkillInfo[] {
	const skillsDir = join(claudeDir, "skills");
	if (!existsSync(skillsDir)) return [];
	const skills: SkillInfo[] = [];

	for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		// Mỗi thư mục con là một skill
		skills.push({ name: entry.name, path: join(skillsDir, entry.name) });
	}
	return skills;
}

/** Quét .claude/rules/ → danh sách PortableItem */
export function discoverRules(claudeDir: string): PortableItem[] {
	const rulesDir = join(claudeDir, "rules");
	if (!existsSync(rulesDir)) return [];
	const items: PortableItem[] = [];

	for (const entry of readdirSync(rulesDir, { withFileTypes: true })) {
		if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
		const filePath = join(rulesDir, entry.name);
		const parsed = readMdFile(filePath);
		if (!parsed) continue;
		const name = entry.name.replace(/\.md$/, "");
		items.push({
			name,
			description: String(parsed.frontmatter.description ?? `Rule: ${name}`),
			type: "rules",
			sourcePath: filePath,
			frontmatter: parsed.frontmatter,
			body: parsed.body,
		});
	}
	return items;
}

/** Quét .claude/hooks/ → danh sách PortableItem (chỉ file .js/.cjs/.mjs) */
export function discoverHooks(claudeDir: string): PortableItem[] {
	const hooksDir = join(claudeDir, "hooks");
	if (!existsSync(hooksDir)) return [];
	const items: PortableItem[] = [];

	for (const entry of readdirSync(hooksDir, { withFileTypes: true })) {
		if (!entry.isFile()) continue;
		// Chỉ migrate hook JavaScript (node-runnable)
		if (!/\.(js|cjs|mjs)$/.test(entry.name)) continue;
		const filePath = join(hooksDir, entry.name);
		let body = "";
		try {
			body = readFileSync(filePath, "utf-8");
		} catch {
			continue;
		}
		const name = entry.name.replace(/\.(js|cjs|mjs)$/, "");
		items.push({
			name,
			description: `Hook: ${name}`,
			type: "hooks",
			sourcePath: filePath,
			frontmatter: {},
			body,
		});
	}
	return items;
}

/** Đọc CLAUDE.md (config) của project → PortableItem hoặc null */
export function discoverConfig(claudeDir: string): PortableItem | null {
	// Tìm CLAUDE.md ở cấp project (cha của .claude/)
	const projectRoot = join(claudeDir, "..");
	const configPath = join(projectRoot, "CLAUDE.md");
	if (!existsSync(configPath)) return null;

	let body = "";
	try {
		body = readFileSync(configPath, "utf-8");
	} catch {
		return null;
	}

	const parsed = parseFrontmatter(body);
	return {
		name: "CLAUDE",
		description: "Cấu hình CLAUDE.md của project",
		type: "config",
		sourcePath: configPath,
		frontmatter: parsed.frontmatter,
		body: parsed.body || body,
	};
}

// ─── Discovery tất cả ──────────────────────────────────────────────────────

export interface DiscoveredItems {
	agents: PortableItem[];
	commands: PortableItem[];
	skills: SkillInfo[];
	rules: PortableItem[];
	hooks: PortableItem[];
	config: PortableItem | null;
}

/** Quét toàn bộ .claude/ của project hoặc global (~/.claude) */
export function discoverAll(claudeDir: string): DiscoveredItems {
	return {
		agents: discoverAgents(claudeDir),
		commands: discoverCommands(claudeDir),
		skills: discoverSkills(claudeDir),
		rules: discoverRules(claudeDir),
		hooks: discoverHooks(claudeDir),
		config: discoverConfig(claudeDir),
	};
}

/** Đường dẫn .claude/ theo scope */
export function resolveClaudeDir(isGlobal: boolean): string {
	if (isGlobal) {
		return join(
			process.env.HOME ?? process.env.USERPROFILE ?? homedir(),
			".claude",
		);
	}
	return join(process.cwd(), ".claude");
}
