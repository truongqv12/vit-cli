/**
 * Integration test cho vit migrate — provider opencode.
 * Dùng Node built-in test runner (node --test).
 * Kiểm tra: fresh install + chạy lại (idempotent) + dry-run.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { discoverAll } from "../../portable/migrate-discovery.js";
import { installPortableItem, installSkillDirectory } from "../../portable/migrate-installer.js";
import { readRegistry } from "../../portable/migrate-registry.js";

// Đường dẫn fixture .claude/ mẫu — fixtures nằm trong src/, không trong dist/.
// Dùng import.meta.url để tính path tuyệt đối, sau đó đổi /dist/ → /src/.
function resolveFixtureDir(): string {
	const fileUrl = import.meta.url;
	// Trên Windows: file:///C:/... → C:/...
	let filePath = fileUrl.replace(/^file:\/\/\//, "").replace(/^file:\/\//, "");
	// Đổi dấu gạch chéo URL → path hệ thống
	filePath = filePath.replace(/\//g, "/");
	// Đổi dist → src để tìm fixtures gốc
	filePath = filePath.replace(/[\\/]dist[\\/]/, "/src/");
	return join(filePath, "..", "fixtures/sample-claude");
}

const FIXTURE_CLAUDE_DIR = resolveFixtureDir();

let tempDir: string;
let origCwd: string;

beforeEach(async () => {
	origCwd = process.cwd();
	tempDir = join(tmpdir(), `vit-migrate-test-${Date.now()}`);
	await mkdir(tempDir, { recursive: true });
	process.chdir(tempDir);
});

afterEach(async () => {
	process.chdir(origCwd);
	await rm(tempDir, { recursive: true, force: true });
});

// ─── Discovery ─────────────────────────────────────────────────────────────

describe("discoverAll", () => {
	it("quét fixture và trả về đúng số lượng item", () => {
		const items = discoverAll(FIXTURE_CLAUDE_DIR);
		assert.equal(items.agents.length, 1, "phải có 1 agent");
		assert.equal(items.agents[0].name, "test-agent");
		assert.equal(items.commands.length, 1, "phải có 1 command");
		assert.equal(items.skills.length, 1, "phải có 1 skill");
		assert.equal(items.rules.length, 1, "phải có 1 rule");
	});
});

// ─── Fresh install ──────────────────────────────────────────────────────────

describe("installPortableItem — opencode — fresh install", () => {
	it("cài agent mới → file tồn tại và có frontmatter đúng", async () => {
		const items = discoverAll(FIXTURE_CLAUDE_DIR);
		const agent = items.agents[0];

		const result = await installPortableItem(agent, "opencode", "agent", false, false);

		assert.equal(result.success, true, `install thất bại: ${result.error ?? ""}`);
		assert.ok(!result.skipped, "không được skip khi fresh install");
		assert.ok(existsSync(result.path), `file đích không tồn tại: ${result.path}`);

		const content = readFileSync(result.path, "utf-8");
		assert.ok(content.includes("mode: subagent"), "thiếu mode: subagent trong frontmatter");
		assert.ok(content.includes("description:"), "thiếu description trong frontmatter");
	});

	it("cài rules → AGENTS.md được tạo với section header", async () => {
		const items = discoverAll(FIXTURE_CLAUDE_DIR);
		const rule = items.rules[0];

		const result = await installPortableItem(rule, "opencode", "rules", false, false);

		assert.equal(result.success, true, `install rules thất bại: ${result.error ?? ""}`);
		assert.ok(existsSync("AGENTS.md"), "AGENTS.md phải được tạo");

		const content = readFileSync("AGENTS.md", "utf-8");
		assert.ok(
			content.includes(`<!-- vit:migrate:${rule.name} -->`),
			"thiếu section header trong AGENTS.md",
		);
	});
});

// ─── Idempotent ─────────────────────────────────────────────────────────────

describe("installPortableItem — opencode — idempotent", () => {
	it("chạy lại agent cùng nội dung → skip (checksum khớp)", async () => {
		const items = discoverAll(FIXTURE_CLAUDE_DIR);
		const agent = items.agents[0];

		// Lần 1
		const first = await installPortableItem(agent, "opencode", "agent", false, false);
		assert.equal(first.success, true);
		assert.ok(!first.skipped);

		// Lần 2
		const second = await installPortableItem(agent, "opencode", "agent", false, false);
		assert.equal(second.success, true);
		assert.equal(second.skipped, true, "lần 2 phải skip");
		assert.ok(second.skipReason?.includes("checksum"), "lý do skip phải đề cập checksum");
	});

	it("registry có entry sau khi cài", async () => {
		const items = discoverAll(FIXTURE_CLAUDE_DIR);
		const agent = items.agents[0];

		await installPortableItem(agent, "opencode", "agent", false, false);

		const registry = await readRegistry(false);
		const entry = registry.entries.find(
			(e) => e.item === agent.name && e.provider === "opencode" && e.type === "agent",
		);
		assert.ok(entry, "phải có entry trong registry");
		assert.ok(entry.checksum, "entry phải có checksum");
		assert.equal(entry.global, false);
	});
});

// ─── Dry-run ────────────────────────────────────────────────────────────────

describe("installPortableItem — dry-run", () => {
	it("dry-run trả về success nhưng không ghi file", async () => {
		const items = discoverAll(FIXTURE_CLAUDE_DIR);
		const agent = items.agents[0];

		const result = await installPortableItem(agent, "opencode", "agent", false, true);

		assert.equal(result.success, true);
		assert.ok(!existsSync(result.path), `dry-run không được tạo file: ${result.path}`);
	});
});

// ─── Skill (opencode trỏ về .claude/skills → skip) ─────────────────────────

describe("installSkillDirectory — opencode", () => {
	it("opencode skills trỏ về .claude/skills (nguồn = đích) → không fail", async () => {
		const items = discoverAll(FIXTURE_CLAUDE_DIR);
		const skill = items.skills[0];

		const result = await installSkillDirectory(skill, "opencode", false, false);

		// Không được fail — skip hoặc success đều chấp nhận
		assert.equal(result.success, true, `skill install thất bại: ${result.error ?? ""}`);
	});
});
