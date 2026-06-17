/** Test cho resolveScope (logic thuần). */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { MigrateOptions } from "../portable/migrate-types.js";
import { resolveScope } from "./migrate-scope-resolver.js";

test("không cờ scope → migrate tất cả", () => {
	assert.deepEqual(resolveScope({}), {
		agents: true,
		commands: true,
		skills: true,
		config: true,
		rules: true,
		hooks: true,
	});
});

test("--only-agents → chỉ agents", () => {
	const s = resolveScope({ onlyAgents: true });
	assert.equal(s.agents, true);
	assert.equal(s.commands, false);
	assert.equal(s.skills, false);
	assert.equal(s.config, false);
	assert.equal(s.rules, false);
	assert.equal(s.hooks, false);
});

test("--config → chỉ config", () => {
	const s = resolveScope({ config: true });
	assert.equal(s.config, true);
	assert.equal(s.agents, false);
});

test("--skip-skills → tất cả trừ skills", () => {
	const s = resolveScope({ skipSkills: true });
	assert.equal(s.skills, false);
	assert.equal(s.agents, true);
	assert.equal(s.commands, true);
});

test("--only-agents + --skip-agents → rỗng (skip thắng)", () => {
	const o: MigrateOptions = { onlyAgents: true, skipAgents: true };
	assert.equal(resolveScope(o).agents, false);
});
