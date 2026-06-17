/** Test cho isGeneratedContextHookName (logic thuần). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { isGeneratedContextHookName } from "./generated-context-hooks.js";

test("nhận đúng hook generated-context", () => {
	assert.equal(isGeneratedContextHookName("session-init.cjs"), true);
	assert.equal(isGeneratedContextHookName("dev-rules-reminder.cjs"), true);
	assert.equal(isGeneratedContextHookName("plan-format-kanban.cjs"), true);
});

test("nhận qua đường dẫn đầy đủ (basename)", () => {
	assert.equal(isGeneratedContextHookName(".claude/hooks/session-state.cjs"), true);
	assert.equal(isGeneratedContextHookName("C:\\www\\x\\.claude\\hooks\\subagent-init.cjs"), true);
});

test("nhận qua tiền tố <x>-<name>", () => {
	assert.equal(isGeneratedContextHookName("00-session-init.cjs"), true);
});

test("KHÔNG nhận hook thật của user", () => {
	assert.equal(isGeneratedContextHookName("my-custom-hook.cjs"), false);
	assert.equal(isGeneratedContextHookName("format-on-save.cjs"), false);
});
