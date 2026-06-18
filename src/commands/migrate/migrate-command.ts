/**
 * Lệnh `vit migrate` — xuất .claude/ sang codex, opencode, antigravity.
 * Luồng: discover → convert (dry-run in kế hoạch) → install (idempotent).
 * Hiển thị UI tách riêng trong migrate-display.ts.
 */
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { log } from "../../shared/logger.js";
import { isGeneratedContextHookName } from "../portable/generated-context-hooks.js";
import { migrateCodexHooksSettings } from "../portable/migrate-hooks-settings-merger.js";
import { discoverAll } from "../portable/migrate-discovery.js";
import { installPortableItem, installSkillDirectory } from "../portable/migrate-installer.js";
import { validateMutualExclusion } from "../portable/migrate-mode-validator.js";
import { PROVIDERS, resolveProviders } from "../portable/migrate-provider-registry.js";
import type { MigrateInstallResult, MigrateOptions, ProviderType } from "../portable/migrate-types.js";
import { printDryRunPlan, printResults } from "./migrate-display.js";
import { resolveScope } from "./migrate-scope-resolver.js";

// ─── Resolve đường dẫn .claude/ ────────────────────────────────────────────

function resolveClaudeDir(isGlobal: boolean): string {
	return isGlobal
		? join(homedir(), ".claude")
		: join(process.cwd(), ".claude");
}

// ─── Handler chính ──────────────────────────────────────────────────────────

export async function runMigrate(options: MigrateOptions): Promise<void> {
	const isGlobal = options.global === true;

	// Chặn cặp cờ mode mâu thuẫn trước khi làm gì
	const modeError = validateMutualExclusion(options);
	if (modeError) {
		log.error(modeError);
		process.exitCode = 1;
		return;
	}

	// Quyết định provider đích (--all > --agent > --providers)
	let selectedProviders: ProviderType[];
	try {
		selectedProviders = resolveProviders(options);
	} catch (err) {
		log.error(err instanceof Error ? err.message : String(err));
		process.exitCode = 1;
		return;
	}

	const dryRun = options.dryRun === true;
	const force = options.force === true;
	const scope = resolveScope(options);
	const claudeDir = resolveClaudeDir(isGlobal);

	// Discover (--source override CHỈ áp cho config)
	log.info(`Quét ${claudeDir} ...`);
	const discovered = discoverAll(claudeDir, { configSource: options.source });

	// --source được chỉ định tường minh nhưng không đọc được → cảnh báo (tránh nuốt im lặng)
	if (options.source && !discovered.config) {
		log.warn(`Không đọc được CLAUDE.md từ --source "${options.source}" — bỏ qua config.`);
	}

	// Loại hook generated-context (plumbing engine): không chạy trên agent đích, chỉ gây nhiễu.
	// Hook thật của user vẫn được migrate bình thường.
	// So theo sourcePath vì name đã bị strip đuôi .cjs (list đối chiếu theo tên file đầy đủ)
	const disabledHooks = discovered.hooks.filter((h) => isGeneratedContextHookName(h.sourcePath));
	if (disabledHooks.length > 0) {
		discovered.hooks = discovered.hooks.filter((h) => !isGeneratedContextHookName(h.sourcePath));
		log.warn(
			`Vô hiệu ${disabledHooks.length} hook generated-context (engine plumbing, không chạy trên agent đích): ` +
			disabledHooks.map((h) => h.name).join(", "),
		);
	}

	// Áp scope: chỉ giữ loại được chọn
	const scoped = {
		agents: scope.agents ? discovered.agents : [],
		commands: scope.commands ? discovered.commands : [],
		skills: scope.skills ? discovered.skills : [],
		rules: scope.rules ? discovered.rules : [],
		hooks: scope.hooks ? discovered.hooks : [],
		config: scope.config ? discovered.config : null,
	};

	const totalItems =
		scoped.agents.length +
		scoped.commands.length +
		scoped.skills.length +
		scoped.rules.length +
		scoped.hooks.length +
		(scoped.config ? 1 : 0);

	if (totalItems === 0) {
		log.warn("Không tìm thấy item nào để migrate (sau khi áp scope). Kiểm tra .claude/ và các cờ --only-*/--skip-*.");
		return;
	}

	log.info(
		`Sẽ migrate: ${scoped.agents.length} agent, ${scoped.commands.length} command, ` +
		`${scoped.skills.length} skill, ${scoped.rules.length} rule, ` +
		`${scoped.hooks.length} hook${scoped.config ? ", 1 config" : ""}`,
	);

	// Dry-run: chỉ in kế hoạch bằng panel (migrate-display.ts)
	if (dryRun) {
		printDryRunPlan(selectedProviders, scoped, isGlobal);
		return;
	}

	// Thực thi install
	log.info(`Migrate sang: ${selectedProviders.map((p) => PROVIDERS[p].displayName).join(", ")}`);
	const results: MigrateInstallResult[] = [];

	for (const provider of selectedProviders) {
		// Agents
		for (const item of scoped.agents) {
			results.push(await installPortableItem(item, provider, "agent", isGlobal, false, force));
		}
		// Commands
		for (const item of scoped.commands) {
			results.push(await installPortableItem(item, provider, "command", isGlobal, false, force));
		}
		// Config
		if (scoped.config) {
			results.push(await installPortableItem(scoped.config, provider, "config", isGlobal, false, force));
		}
		// Rules
		for (const item of scoped.rules) {
			results.push(await installPortableItem(item, provider, "rules", isGlobal, false, force));
		}
		// Hooks (chỉ codex — opencode và antigravity không hỗ trợ)
		for (const item of scoped.hooks) {
			results.push(await installPortableItem(item, provider, "hooks", isGlobal, false, force));
		}
		// Skills (directory-based)
		for (const skill of scoped.skills) {
			results.push(await installSkillDirectory(skill, provider, isGlobal, false, force));
		}
	}

	// Đăng ký Codex hooks: ghi .codex/hooks.json + bật [features] hooks=true.
	// Chỉ chạy khi migrate sang codex và có hook cài thành công.
	// Bọc try/catch: lỗi bất ngờ (vd lock contention) KHÔNG được che mất báo cáo kết quả install.
	if (selectedProviders.includes("codex") && scoped.hooks.length > 0) {
		try {
			await registerCodexHooks(results, isGlobal, claudeDir);
		} catch (err) {
			log.error(
				`Đăng ký Codex hook gặp lỗi không mong muốn: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	// In kết quả và set exit code nếu có lỗi (migrate-display.ts)
	printResults(results);
}

// ─── Đăng ký Codex hooks (sau khi copy file) ─────────────────────────────────

/**
 * Sau khi copy file hook vào .codex/hooks/, đọc .claude/settings.json rồi sinh
 * .codex/hooks.json + bật [features] hooks=true để Codex nhận hook.
 *
 * Lưu ý: hooks dir truyền dạng TƯƠNG ĐỐI cho project scope (".codex/hooks",
 * ".claude/hooks") để dir-rewrite khớp command dạng `$CLAUDE_PROJECT_DIR/...`
 * → cho ra path phẳng (đúng như claudekit/ck).
 */
async function registerCodexHooks(
	results: MigrateInstallResult[],
	isGlobal: boolean,
	claudeDir: string,
): Promise<void> {
	const codexConfig = PROVIDERS.codex;
	if (!codexConfig.hooksSettingsPath || !codexConfig.featuresConfigPath || !codexConfig.hooks) {
		return;
	}

	const hookResults = results.filter(
		(r) => r.provider === "codex" && r.portableType === "hooks" && r.success && !r.skipped,
	);
	if (hookResults.length === 0) return;

	const installedHookFiles = hookResults.map((r) => basename(r.path));
	const installedHookAbsolutePaths = hookResults
		.map((r) => r.installAbsolutePath)
		.filter((p): p is string => Boolean(p));

	const claudeSettingsPath = join(claudeDir, "settings.json");
	const hooksJsonPath = isGlobal
		? codexConfig.hooksSettingsPath.globalPath
		: join(process.cwd(), codexConfig.hooksSettingsPath.projectPath);
	const configTomlPath = isGlobal
		? codexConfig.featuresConfigPath.globalPath
		: join(process.cwd(), codexConfig.featuresConfigPath.projectPath);
	// Dir rewrite: tương đối ở project scope, tuyệt đối ở global scope.
	const targetHooksDir = isGlobal
		? (codexConfig.hooks.globalPath ?? "")
		: (codexConfig.hooks.projectPath ?? "");
	const sourceHooksDir = isGlobal ? join(homedir(), ".claude/hooks") : ".claude/hooks";

	const result = await migrateCodexHooksSettings({
		installedHookFiles,
		installedHookAbsolutePaths,
		claudeSettingsPath,
		hooksJsonPath,
		configTomlPath,
		targetHooksDir,
		sourceHooksDir,
		global: isGlobal,
	});

	for (const w of result.warnings ?? []) log.warn(`[hook] ${w.message}`);
	if (result.status === "registered") {
		log.info(
			`Đã đăng ký ${result.hooksRegistered} Codex hook vào ${hooksJsonPath}` +
			(result.featureFlagWritten ? " + bật [features] hooks=true" : ""),
		);
	} else if (!result.success) {
		log.error(`Đăng ký Codex hook thất bại: ${result.error ?? result.status}`);
	} else if (result.message) {
		log.warn(`[hook] ${result.message}`);
	}
}
