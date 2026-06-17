/**
 * Kiểu dữ liệu chia sẻ cho tính năng migrate sang provider AI.
 * Chỉ hỗ trợ 3 provider: codex, opencode, antigravity.
 */

// --- Provider ---

/** Danh sách provider được hỗ trợ (LEAN: chỉ 3) */
export type ProviderType = "codex" | "opencode" | "antigravity";

/** Định dạng chuyển đổi nội dung nguồn sang provider đích */
export type ConversionFormat =
	| "direct-copy"            // Sao chép nguyên bản (có thể thay .claude/ → .agent/)
	| "fm-to-fm"               // Biến đổi frontmatter (OpenCode agents/commands)
	| "fm-to-codex-toml"       // Agents → Codex TOML
	| "command-to-codex-skill" // Commands → Codex skill SKILL.md
	| "md-strip";              // Xóa tham chiếu Claude-specific (config/rules)

/** Chiến lược ghi file đích */
export type WriteStrategy =
	| "per-file"      // Một file đầu ra cho mỗi file nguồn
	| "merge-single"  // Gộp tất cả vào một file (vd: AGENTS.md)
	| "single-file"   // Ghi một file duy nhất
	| "codex-toml";   // Per-file .toml + cập nhật config.toml

/** Cấu hình đường dẫn + định dạng cho một loại item theo provider */
export interface ProviderPathConfig {
	projectPath: string | null;
	globalPath: string | null;
	format: ConversionFormat;
	writeStrategy: WriteStrategy;
	fileExtension: string;
}

/** Cấu hình đầy đủ của một provider */
export interface ProviderConfig {
	name: ProviderType;
	displayName: string;
	agents: ProviderPathConfig | null;
	commands: ProviderPathConfig | null;
	skills: ProviderPathConfig | null;
	config: ProviderPathConfig | null;
	rules: ProviderPathConfig | null;
	hooks: ProviderPathConfig | null;
}

// --- Portable Items ---

/** Loại item di chuyển */
export type PortableType = "agent" | "command" | "skill" | "config" | "rules" | "hooks";

/** Frontmatter đã phân tích từ file nguồn */
export interface ParsedFrontmatter {
	name?: string;
	description?: string;
	model?: string;
	tools?: string;
	[key: string]: unknown;
}

/** Một item di chuyển được khám phá từ .claude/ */
export interface PortableItem {
	name: string;
	description: string;
	type: PortableType;
	sourcePath: string;
	frontmatter: ParsedFrontmatter;
	body: string;
	segments?: string[];
}

/** Thông tin một skill (thư mục) */
export interface SkillInfo {
	name: string;
	path: string;
}

/** Kết quả chuyển đổi item sang định dạng provider */
export interface ConversionResult {
	content: string;
	filename: string;
	warnings: string[];
	error?: string;
}

// --- Install Result ---

/** Kết quả cài đặt một item vào provider */
export interface MigrateInstallResult {
	provider: ProviderType;
	providerDisplayName: string;
	success: boolean;
	path: string;
	itemName: string;
	portableType: PortableType;
	skipped?: boolean;
	skipReason?: string;
	overwritten?: boolean;
	error?: string;
	warnings?: string[];
}

// --- Registry ---

/** Một mục trong registry theo dõi item đã cài */
export interface RegistryEntry {
	item: string;
	type: PortableType;
	provider: ProviderType;
	global: boolean;
	path: string;
	checksum: string;
	installedAt: string;
}

/** Registry đầy đủ */
export interface MigrateRegistry {
	version: number;
	entries: RegistryEntry[];
}

// --- Options ---

/** Tùy chọn cho lệnh vit migrate */
export interface MigrateOptions {
	dryRun?: boolean;
	global?: boolean;
	/** Alias ẩn của --agent: danh sách provider ngăn cách dấu phẩy (giữ lệnh cũ chạy được) */
	providers?: string;

	// --- Chọn provider ---
	/** --agent: provider đích, variadic (string[]) hoặc CSV (string) */
	agent?: string | string[];
	/** --all: migrate sang cả 3 provider */
	all?: boolean;

	// --- Ghi đè / xác nhận ---
	/** --force: cài lại cả khi nội dung không đổi (đè + backup) */
	force?: boolean;
	/** --yes: bỏ qua prompt xác nhận (hiện vit chưa có prompt → giữ để parity bề mặt) */
	yes?: boolean;

	// --- Scope filter theo loại item ---
	onlyAgents?: boolean;
	onlyCommands?: boolean;
	onlySkills?: boolean;
	/** --config: chỉ migrate CLAUDE.md config */
	config?: boolean;
	/** --rules: chỉ migrate .claude/rules/ */
	rules?: boolean;
	/** --hooks: chỉ migrate .claude/hooks/ */
	hooks?: boolean;
	skipAgents?: boolean;
	skipCommands?: boolean;
	skipSkills?: boolean;
	skipConfig?: boolean;
	skipRules?: boolean;
	skipHooks?: boolean;

	// --- Nguồn config tùy biến ---
	/** --source: đường dẫn CLAUDE.md tùy biến (CHỈ áp cho config) */
	source?: string;

	// --- Mode flags (parity bề mặt, KISS) ---
	install?: boolean;
	reconcile?: boolean;
	reinstallEmptyDirs?: boolean;
	respectDeletions?: boolean;
}
