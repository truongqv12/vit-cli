/**
 * Scope resolver — quyết định loại item nào được migrate dựa trên các cờ --only-* / --skip-*.
 * Port rút gọn từ ck (truth table) theo KISS: vit chỉ chạy qua CLI nên không cần programmatic fallback.
 *
 * Quy tắc:
 *   - Có bất kỳ cờ "only" nào (only-agents/commands/skills, --config, --rules, --hooks)
 *     → chỉ migrate các loại được bật.
 *   - Ngược lại → migrate tất cả TRỪ các loại bị --skip-*.
 *   - --skip-X luôn loại X kể cả trong only-mode (skip thắng trong phép giao).
 */
import type { MigrateOptions } from "../portable/migrate-types.js";

/** Phạm vi migrate đã giải: true = migrate loại đó */
export interface MigrationScope {
	agents: boolean;
	commands: boolean;
	skills: boolean;
	config: boolean;
	rules: boolean;
	hooks: boolean;
}

/** Giải scope từ options CLI */
export function resolveScope(o: MigrateOptions): MigrationScope {
	const onlyAgents = o.onlyAgents === true;
	const onlyCommands = o.onlyCommands === true;
	const onlySkills = o.onlySkills === true;
	const onlyConfig = o.config === true;
	const onlyRules = o.rules === true;
	const onlyHooks = o.hooks === true;

	const hasOnly =
		onlyAgents || onlyCommands || onlySkills || onlyConfig || onlyRules || onlyHooks;

	// Trong only-mode: chỉ loại được bật. Ngoài only-mode: mặc định tất cả.
	const pick = (only: boolean) => (hasOnly ? only : true);

	return {
		agents: pick(onlyAgents) && o.skipAgents !== true,
		commands: pick(onlyCommands) && o.skipCommands !== true,
		skills: pick(onlySkills) && o.skipSkills !== true,
		config: pick(onlyConfig) && o.skipConfig !== true,
		rules: pick(onlyRules) && o.skipRules !== true,
		hooks: pick(onlyHooks) && o.skipHooks !== true,
	};
}
