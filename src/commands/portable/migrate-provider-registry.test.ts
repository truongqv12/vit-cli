/** Test cho resolveProviders + parseProviderList (logic thuần, không I/O). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseProviderList, resolveProviders } from "./migrate-provider-registry.js";

test("parseProviderList: rỗng → cả 3 provider", () => {
	assert.deepEqual(parseProviderList(undefined), ["codex", "opencode", "antigravity"]);
});

test("parseProviderList: CSV hợp lệ", () => {
	assert.deepEqual(parseProviderList("codex,opencode"), ["codex", "opencode"]);
});

test("parseProviderList: provider sai → throw", () => {
	assert.throws(() => parseProviderList("codex,khong-ton-tai"), /không hợp lệ/);
});

test("resolveProviders: --all thắng tất cả", () => {
	assert.deepEqual(resolveProviders({ all: true, agent: "codex" }), [
		"codex",
		"opencode",
		"antigravity",
	]);
});

test("resolveProviders: --agent scalar", () => {
	assert.deepEqual(resolveProviders({ agent: "codex" }), ["codex"]);
});

test("resolveProviders: --agent variadic (mảng)", () => {
	assert.deepEqual(resolveProviders({ agent: ["codex", "opencode"] }), ["codex", "opencode"]);
});

test("resolveProviders: --agent CSV trong 1 token", () => {
	assert.deepEqual(resolveProviders({ agent: "codex,opencode" }), ["codex", "opencode"]);
});

test("resolveProviders: fallback --providers khi không có --agent", () => {
	assert.deepEqual(resolveProviders({ providers: "antigravity" }), ["antigravity"]);
});

test("resolveProviders: không cờ nào → cả 3", () => {
	assert.deepEqual(resolveProviders({}), ["codex", "opencode", "antigravity"]);
});

test("resolveProviders: --agent provider sai → throw", () => {
	assert.throws(() => resolveProviders({ agent: ["codex", "sai"] }), /không hợp lệ/);
});
