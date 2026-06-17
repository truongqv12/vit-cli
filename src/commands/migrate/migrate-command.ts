/**
 * Lệnh `vit migrate` — xuất .claude/ sang codex, opencode, antigravity.
 * Luồng: discover → convert (dry-run in kế hoạch) → install (idempotent).
 */
import { homedir } from "node:os";
import { join } from "node:path";
import pc from "picocolors";
import { log } from "../../shared/logger.js";
import { discoverAll } from "../portable/migrate-discovery.js";
import { installPortableItem, installSkillDirectory } from "../portable/migrate-installer.js";
import { ALL_PROVIDERS, PROVIDERS, parseProviderList } from "../portable/migrate-provider-registry.js";
import type {
	MigrateInstallResult,
	MigrateOptions,
	PortableItem,
	ProviderType,
	SkillInfo,
} from "../portable/migrate-types.js";

// ─── Resolve đường dẫn .claude/ ────────────────────────────────────────────

function resolveClaudeDir(isGlobal: boolean): string {
	return isGlobal
		? join(homedir(), ".claude")
		: join(process.cwd(), ".claude");
}

// ─── In kế hoạch dry-run ────────────────────────────────────────────────────

function printDryRunPlan(
	providers: ProviderType[],
	items: {
		agents: PortableItem[];
		commands: PortableItem[];
		skills: SkillInfo[];
		rules: PortableItem[];
		hooks: PortableItem[];
		config: PortableItem | null;
	},
	isGlobal: boolean,
): void {
	log.plain(pc.bold("\n[Dry-run] Kế hoạch migrate:"));
	log.plain(pc.dim(`  Scope: ${isGlobal ? "global (~/.claude)" : "project (.claude/)"}`));
	log.plain(pc.dim(`  Providers: ${providers.map((p) => PROVIDERS[p].displayName).join(", ")}`));
	log.plain("");

	const totalItems =
		items.agents.length +
		items.commands.length +
		items.skills.length +
		items.rules.length +
		items.hooks.length +
		(items.config ? 1 : 0);

	if (totalItems === 0) {
		log.plain(pc.yellow("  Không tìm thấy item nào trong .claude/"));
		return;
	}

	const printGroup = (label: string, list: Array<{ name: string }>) => {
		if (list.length === 0) return;
		log.plain(pc.cyan(`  ${label} (${list.length}):`));
		for (const item of list) {
			log.plain(`    ${pc.dim("→")} ${item.name}`);
		}
	};

	printGroup("Agents", items.agents);
	printGroup("Commands", items.commands);
	printGroup("Skills", items.skills);
	printGroup("Rules", items.rules);
	printGroup("Hooks", items.hooks);
	if (items.config) printGroup("Config", [items.config]);

	log.plain("");
	log.plain(pc.dim(`  Tổng: ${totalItems} item × ${providers.length} provider`));

	// In đường dẫn đích cho từng provider
	for (const provider of providers) {
		const cfg = PROVIDERS[provider];
		log.plain(pc.bold(`\n  [${cfg.displayName}]`));

		const printPath = (label: string, path: string | null) => {
			if (!path) return;
			log.plain(`    ${label}: ${pc.dim(path)}`);
		};

		const a = isGlobal ? cfg.agents?.globalPath : cfg.agents?.projectPath;
		const c = isGlobal ? cfg.commands?.globalPath : cfg.commands?.projectPath;
		const s = isGlobal ? cfg.skills?.globalPath : cfg.skills?.projectPath;
		const conf = isGlobal ? cfg.config?.globalPath : cfg.config?.projectPath;
		const r = isGlobal ? cfg.rules?.globalPath : cfg.rules?.projectPath;

		if (items.agents.length > 0 && a) printPath("agents", a);
		if (items.commands.length > 0 && c) printPath("commands", c);
		if (items.skills.length > 0 && s) printPath("skills", s);
		if ((items.rules.length > 0 || items.config) && (r ?? conf)) {
			printPath("rules/config", r ?? conf ?? null);
		}
	}
	log.plain("");
}

// ─── In kết quả thực thi ────────────────────────────────────────────────────

function printResults(results: MigrateInstallResult[]): void {
	const installed = results.filter((r) => r.success && !r.skipped && !r.overwritten);
	const updated = results.filter((r) => r.success && !r.skipped && r.overwritten);
	const skipped = results.filter((r) => r.skipped);
	const failed = results.filter((r) => !r.success);

	if (installed.length > 0) {
		log.plain(pc.bold(`\n${pc.green("[OK]")} Đã cài mới (${installed.length}):`));
		for (const r of installed) {
			log.plain(`  ${pc.dim("→")} [${r.provider}] ${r.portableType}/${r.itemName}: ${pc.dim(r.path)}`);
		}
	}
	if (updated.length > 0) {
		log.plain(pc.bold(`\n${pc.cyan("[↑]")} Đã cập nhật (${updated.length}):`));
		for (const r of updated) {
			log.plain(`  ${pc.dim("→")} [${r.provider}] ${r.portableType}/${r.itemName}`);
		}
	}
	if (skipped.length > 0) {
		log.plain(pc.bold(`\n${pc.dim("[−]")} Bỏ qua (${skipped.length}):`));
		for (const r of skipped) {
			log.plain(`  ${pc.dim("→")} [${r.provider}] ${r.portableType}/${r.itemName}: ${pc.dim(r.skipReason ?? "")}`);
		}
	}
	if (failed.length > 0) {
		log.plain(pc.bold(`\n${pc.red("[X]")} Thất bại (${failed.length}):`));
		for (const r of failed) {
			log.plain(`  ${pc.dim("→")} [${r.provider}] ${r.portableType}/${r.itemName}: ${pc.red(r.error ?? "lỗi không xác định")}`);
		}
	}

	log.plain("");
	const summary = [
		installed.length > 0 ? `${installed.length} mới` : "",
		updated.length > 0 ? `${updated.length} cập nhật` : "",
		skipped.length > 0 ? `${skipped.length} bỏ qua` : "",
		failed.length > 0 ? `${failed.length} lỗi` : "",
	]
		.filter(Boolean)
		.join(", ");

	if (failed.length > 0) {
		log.error(`vit migrate hoàn tất có lỗi: ${summary}`);
		process.exitCode = 1;
	} else {
		log.ok(`vit migrate hoàn tất: ${summary || "không có gì thay đổi"}`);
	}
}

// ─── Handler chính ──────────────────────────────────────────────────────────

export async function runMigrate(options: MigrateOptions): Promise<void> {
	const isGlobal = options.global === true;

	// Parse providers
	let selectedProviders: ProviderType[];
	try {
		selectedProviders = parseProviderList(options.providers);
	} catch (err) {
		log.error(err instanceof Error ? err.message : String(err));
		process.exitCode = 1;
		return;
	}

	const dryRun = options.dryRun === true;
	const claudeDir = resolveClaudeDir(isGlobal);

	// Discover
	log.info(`Quét ${pc.cyan(claudeDir)} ...`);
	const discovered = discoverAll(claudeDir);

	const totalItems =
		discovered.agents.length +
		discovered.commands.length +
		discovered.skills.length +
		discovered.rules.length +
		discovered.hooks.length +
		(discovered.config ? 1 : 0);

	if (totalItems === 0) {
		log.warn("Không tìm thấy item nào để migrate. Kiểm tra lại .claude/ của project.");
		return;
	}

	log.info(
		`Tìm thấy: ${discovered.agents.length} agent, ${discovered.commands.length} command, ` +
		`${discovered.skills.length} skill, ${discovered.rules.length} rule, ` +
		`${discovered.hooks.length} hook${discovered.config ? ", 1 config" : ""}`,
	);

	// Dry-run: chỉ in kế hoạch
	if (dryRun) {
		printDryRunPlan(selectedProviders, discovered, isGlobal);
		log.info("Dry-run: không ghi file. Chạy không có --dry-run để thực thi.");
		return;
	}

	// Thực thi install
	log.info(`Migrate sang: ${selectedProviders.map((p) => pc.cyan(PROVIDERS[p].displayName)).join(", ")}`);
	const results: MigrateInstallResult[] = [];

	for (const provider of selectedProviders) {
		// Agents
		for (const item of discovered.agents) {
			results.push(await installPortableItem(item, provider, "agent", isGlobal, false));
		}
		// Commands
		for (const item of discovered.commands) {
			results.push(await installPortableItem(item, provider, "command", isGlobal, false));
		}
		// Config
		if (discovered.config) {
			results.push(await installPortableItem(discovered.config, provider, "config", isGlobal, false));
		}
		// Rules
		for (const item of discovered.rules) {
			results.push(await installPortableItem(item, provider, "rules", isGlobal, false));
		}
		// Hooks (chỉ codex — opencode và antigravity không hỗ trợ)
		for (const item of discovered.hooks) {
			results.push(await installPortableItem(item, provider, "hooks", isGlobal, false));
		}
		// Skills (directory-based)
		for (const skill of discovered.skills) {
			results.push(await installSkillDirectory(skill, provider, isGlobal, false));
		}
	}

	printResults(results);
}
