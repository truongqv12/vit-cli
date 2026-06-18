/**
 * Test cho pipeline Codex hooks: transform, features-flag, capabilities.
 * Chạy bằng: node --test dist/**\/*.test.js
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
	CODEX_CAPABILITY_TABLE,
	detectCodexCapabilities,
} from "./migrate-codex-capabilities.js";
import { ensureCodexHooksFeatureFlag } from "./migrate-codex-features-flag.js";
import {
	type HooksSection,
	convertClaudeHooksToCodex,
} from "./converters/migrate-converter-claude-to-codex-hooks.js";
import { mkdir } from "node:fs/promises";
import { migrateCodexHooksSettings } from "./migrate-hooks-settings-merger.js";

const NEWEST = CODEX_CAPABILITY_TABLE[0];

test("convertClaudeHooksToCodex: bỏ event Codex không hỗ trợ (SubagentStart/Stop)", () => {
	const source: HooksSection = {
		UserPromptSubmit: [{ hooks: [{ type: "command", command: "node x.cjs" }] }],
		SubagentStart: [{ hooks: [{ type: "command", command: "node y.cjs" }] }],
		SubagentStop: [{ hooks: [{ type: "command", command: "node z.cjs" }] }],
	};
	const result = convertClaudeHooksToCodex(source, NEWEST);
	assert.ok(result.UserPromptSubmit, "giữ UserPromptSubmit");
	assert.equal(result.SubagentStart, undefined, "drop SubagentStart");
	assert.equal(result.SubagentStop, undefined, "drop SubagentStop");
});

test("convertClaudeHooksToCodex: giữ PreToolUse với matcher", () => {
	const source: HooksSection = {
		PreToolUse: [
			{
				matcher: "Bash|Glob|Grep|Read|Edit|Write",
				hooks: [{ type: "command", command: "node scout.cjs" }],
			},
		],
	};
	const result = convertClaudeHooksToCodex(source, NEWEST);
	assert.ok(result.PreToolUse, "giữ PreToolUse");
	assert.equal(result.PreToolUse[0].matcher, "Bash|Glob|Grep|Read|Edit|Write");
});

test("convertClaudeHooksToCodex: rewrite path .claude/hooks -> .codex/hooks", () => {
	const source: HooksSection = {
		UserPromptSubmit: [
			{ hooks: [{ type: "command", command: 'node ".claude/hooks/simplify-gate.cjs"' }] },
		],
	};
	const result = convertClaudeHooksToCodex(source, NEWEST, {
		sourceDir: ".claude/hooks",
		targetDir: ".codex/hooks",
	});
	assert.match(result.UserPromptSubmit[0].hooks[0].command, /\.codex\/hooks\/simplify-gate\.cjs/);
});

test("detectCodexCapabilities: fallback an toàn khi không có codex (requiresFeatureFlag)", async () => {
	// Ép strict để khỏi phụ thuộc codex binary; phải trả entry hợp lệ.
	const prev = process.env.VIT_CODEX_COMPAT;
	process.env.VIT_CODEX_COMPAT = "strict";
	try {
		const caps = await detectCodexCapabilities();
		assert.equal(typeof caps.version, "string");
		assert.equal(caps.requiresFeatureFlag, true);
	} finally {
		if (prev === undefined) delete process.env.VIT_CODEX_COMPAT;
		else process.env.VIT_CODEX_COMPAT = prev;
	}
});

test("ensureCodexHooksFeatureFlag: ghi [features] hooks=true (idempotent)", async () => {
	const dir = await mkdtemp(join(tmpdir(), "vit-codex-"));
	const configPath = join(dir, "config.toml");
	try {
		const r1 = await ensureCodexHooksFeatureFlag(configPath);
		assert.ok(r1.status === "written" || r1.status === "updated", `status=${r1.status}`);
		const content = await readFile(configPath, "utf8");
		assert.match(content, /\[features\]/);
		assert.match(content, /hooks = true/);

		// Idempotent: chạy lại không lỗi, vẫn còn flag
		const r2 = await ensureCodexHooksFeatureFlag(configPath);
		assert.ok(["already-set", "updated", "written"].includes(r2.status), `status2=${r2.status}`);
		const content2 = await readFile(configPath, "utf8");
		assert.match(content2, /hooks = true/);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("ensureCodexHooksFeatureFlag: gộp vào [features] sẵn có, không nhân đôi header", async () => {
	const dir = await mkdtemp(join(tmpdir(), "vit-codex-"));
	const configPath = join(dir, "config.toml");
	try {
		await writeFile(configPath, "[features]\nunified_exec = true\n", "utf8");
		await ensureCodexHooksFeatureFlag(configPath);
		const content = await readFile(configPath, "utf8");
		const headerCount = (content.match(/^\[features\]/gm) ?? []).length;
		assert.equal(headerCount, 1, "chỉ 1 header [features]");
		assert.match(content, /unified_exec = true/);
		assert.match(content, /hooks = true/);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("migrateCodexHooksSettings: installedHookFiles rỗng → no-installed-files", async () => {
	const result = await migrateCodexHooksSettings({
		installedHookFiles: [],
		installedHookAbsolutePaths: [],
		claudeSettingsPath: "X:/khong-ton-tai/settings.json",
		hooksJsonPath: "X:/khong-ton-tai/.codex/hooks.json",
		configTomlPath: "X:/khong-ton-tai/.codex/config.toml",
		targetHooksDir: ".codex/hooks",
		sourceHooksDir: ".claude/hooks",
		global: false,
	});
	assert.equal(result.status, "no-installed-files");
	assert.equal(result.success, true);
	assert.equal(result.hooksRegistered, 0);
});

test("migrateCodexHooksSettings: e2e đăng ký + drop event lạ + prune ghost Windows + idempotent", async () => {
	const prev = process.env.VIT_CODEX_COMPAT;
	process.env.VIT_CODEX_COMPAT = "optimistic"; // dùng capability mới nhất → matcher đầy đủ
	const root = await mkdtemp(join(tmpdir(), "vit-codex-e2e-"));
	const claudeHooks = join(root, ".claude", "hooks");
	const codexHooks = join(root, ".codex", "hooks");
	const claudeSettingsPath = join(root, ".claude", "settings.json");
	const hooksJsonPath = join(root, ".codex", "hooks.json");
	const configTomlPath = join(root, ".codex", "config.toml");
	try {
		await mkdir(claudeHooks, { recursive: true });
		await mkdir(codexHooks, { recursive: true });

		// File hook "đã cài" trong .codex/hooks/
		const simplifyAbs = join(codexHooks, "simplify-gate.cjs");
		const scoutAbs = join(codexHooks, "scout-block.cjs");
		await writeFile(simplifyAbs, "module.exports = {};\n", "utf8");
		await writeFile(scoutAbs, "module.exports = {};\n", "utf8");

		// settings.json nguồn: UserPromptSubmit + PreToolUse hợp lệ, SubagentStart phải bị drop
		await writeFile(
			claudeSettingsPath,
			JSON.stringify({
				hooks: {
					UserPromptSubmit: [
						{ hooks: [{ type: "command", command: 'node ".claude/hooks/simplify-gate.cjs"' }] },
					],
					PreToolUse: [
						{
							matcher: "Bash|Glob|Grep|Read|Edit|Write",
							hooks: [{ type: "command", command: 'node ".claude/hooks/scout-block.cjs"' }],
						},
					],
					SubagentStart: [
						{ hooks: [{ type: "command", command: 'node ".claude/hooks/ghost-agent.cjs"' }] },
					],
				},
			}),
			"utf8",
		);

		// Pre-seed hooks.json với entry ghost ck-managed (Windows path, file không tồn tại) → phải bị prune (H1)
		const ghostWinPath = "C:/khong-ton-tai/.codex/hooks/ghost.cjs";
		await writeFile(
			hooksJsonPath,
			JSON.stringify({
				hooks: {
					PreToolUse: [
						{ matcher: "Bash", hooks: [{ type: "command", command: `node "${ghostWinPath}"` }] },
					],
				},
			}),
			"utf8",
		);

		const result = await migrateCodexHooksSettings({
			installedHookFiles: ["simplify-gate.cjs", "scout-block.cjs"],
			installedHookAbsolutePaths: [simplifyAbs, scoutAbs],
			claudeSettingsPath,
			hooksJsonPath,
			configTomlPath,
			targetHooksDir: codexHooks,
			sourceHooksDir: claudeHooks,
			global: false,
		});

		assert.equal(result.status, "registered", `status=${result.status} err=${result.error}`);
		assert.ok(result.hooksRegistered >= 2, `registered=${result.hooksRegistered}`);

		const hooksJson = JSON.parse(await readFile(hooksJsonPath, "utf8"));
		assert.ok(hooksJson.hooks.UserPromptSubmit, "giữ UserPromptSubmit");
		assert.ok(hooksJson.hooks.PreToolUse, "giữ PreToolUse");
		assert.equal(hooksJson.hooks.SubagentStart, undefined, "drop SubagentStart");

		// H1: ghost Windows path phải bị prune khỏi hooks.json
		const serialized = JSON.stringify(hooksJson);
		assert.ok(!serialized.includes("ghost.cjs"), "ghost ck-managed (Windows) đã bị prune");

		// features flag
		const toml = await readFile(configTomlPath, "utf8");
		assert.match(toml, /hooks = true/);

		// Idempotent: chạy lại không nhân đôi entry trong cùng event/matcher
		const before = JSON.parse(await readFile(hooksJsonPath, "utf8"));
		await migrateCodexHooksSettings({
			installedHookFiles: ["simplify-gate.cjs", "scout-block.cjs"],
			installedHookAbsolutePaths: [simplifyAbs, scoutAbs],
			claudeSettingsPath,
			hooksJsonPath,
			configTomlPath,
			targetHooksDir: codexHooks,
			sourceHooksDir: claudeHooks,
			global: false,
		});
		const after = JSON.parse(await readFile(hooksJsonPath, "utf8"));
		assert.equal(
			after.hooks.UserPromptSubmit.length,
			before.hooks.UserPromptSubmit.length,
			"không nhân đôi group UserPromptSubmit",
		);
	} finally {
		if (prev === undefined) delete process.env.VIT_CODEX_COMPAT;
		else process.env.VIT_CODEX_COMPAT = prev;
		await rm(root, { recursive: true, force: true });
	}
});
