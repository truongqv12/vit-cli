/**
 * Provider registry — khai báo 3 provider được hỗ trợ: codex, opencode, antigravity.
 * Path và format lấy ĐÚNG từ nguồn gốc claudekit-cli/provider-registry.ts.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProviderConfig, ProviderType } from "./migrate-types.js";

const home = homedir();

/** Registry 3 provider được hỗ trợ */
export const PROVIDERS: Record<ProviderType, ProviderConfig> = {
	codex: {
		name: "codex",
		displayName: "Codex",
		agents: {
			projectPath: ".codex/agents",
			globalPath: join(home, ".codex/agents"),
			format: "fm-to-codex-toml",
			writeStrategy: "codex-toml",
			fileExtension: ".toml",
		},
		commands: {
			// Codex nhập command thành skill, không phải prompt file
			projectPath: ".agents/skills",
			globalPath: join(home, ".agents/skills"),
			format: "command-to-codex-skill",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		skills: {
			projectPath: ".agents/skills",
			globalPath: join(home, ".agents/skills"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: "AGENTS.md",
			globalPath: join(home, ".codex/AGENTS.md"),
			format: "md-strip",
			writeStrategy: "merge-single",
			fileExtension: ".md",
		},
		rules: {
			projectPath: "AGENTS.md",
			globalPath: join(home, ".codex/AGENTS.md"),
			format: "md-strip",
			writeStrategy: "merge-single",
			fileExtension: ".md",
		},
		hooks: {
			projectPath: ".codex/hooks",
			globalPath: join(home, ".codex/hooks"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: "",
		},
	},

	opencode: {
		name: "opencode",
		displayName: "OpenCode",
		agents: {
			projectPath: ".opencode/agents",
			globalPath: join(home, ".config/opencode/agents"),
			format: "fm-to-fm",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		commands: {
			projectPath: ".opencode/commands",
			globalPath: join(home, ".config/opencode/commands"),
			format: "fm-to-fm",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		skills: {
			// OpenCode đọc skill root tương thích Claude — không copy riêng để tránh shadow
			projectPath: ".claude/skills",
			globalPath: join(home, ".claude/skills"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: "AGENTS.md",
			globalPath: join(home, ".config/opencode/AGENTS.md"),
			format: "md-strip",
			writeStrategy: "merge-single",
			fileExtension: ".md",
		},
		rules: {
			projectPath: "AGENTS.md",
			globalPath: join(home, ".config/opencode/AGENTS.md"),
			format: "md-strip",
			writeStrategy: "merge-single",
			fileExtension: ".md",
		},
		// OpenCode không hỗ trợ hooks
		hooks: null,
	},

	antigravity: {
		name: "antigravity",
		displayName: "Antigravity",
		// Antigravity không có agents riêng — agents được migrate thành skills
		agents: null,
		commands: {
			projectPath: ".agent/workflows",
			globalPath: null, // Chỉ có project-level được xác nhận
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		skills: {
			// Skills dùng định dạng thư mục <name>/SKILL.md
			projectPath: ".agent/skills",
			globalPath: join(home, ".gemini/antigravity/skills"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: "GEMINI.md",
			globalPath: join(home, ".gemini/GEMINI.md"),
			format: "md-strip",
			writeStrategy: "single-file",
			fileExtension: ".md",
		},
		rules: {
			projectPath: ".agent/rules",
			globalPath: null, // Không có global rules path riêng
			format: "md-strip",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		// Antigravity không hỗ trợ hooks
		hooks: null,
	},
};

/** Lấy cấu hình provider theo tên */
export function getProviderConfig(provider: ProviderType): ProviderConfig {
	return PROVIDERS[provider];
}

/** Danh sách tất cả provider được hỗ trợ */
export const ALL_PROVIDERS: ProviderType[] = ["codex", "opencode", "antigravity"];

/** Parse chuỗi providers từ CLI (vd: "codex,opencode") → mảng ProviderType hợp lệ */
export function parseProviderList(input: string | undefined): ProviderType[] {
	if (!input) return ALL_PROVIDERS;
	const parsed = input
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	const invalid = parsed.filter((p) => !ALL_PROVIDERS.includes(p as ProviderType));
	if (invalid.length > 0) {
		throw new Error(`Provider không hợp lệ: ${invalid.join(", ")}. Chỉ hỗ trợ: ${ALL_PROVIDERS.join(", ")}`);
	}
	return parsed as ProviderType[];
}

/**
 * Lấy đường dẫn đích cho một loại item của provider.
 * Trả về null nếu provider không hỗ trợ loại đó.
 */
export function getProviderBasePath(
	provider: ProviderType,
	portableType: "agents" | "commands" | "skills" | "config" | "rules" | "hooks",
	isGlobal: boolean,
): string | null {
	const config = PROVIDERS[provider][portableType];
	if (!config) return null;
	return isGlobal ? config.globalPath : config.projectPath;
}
