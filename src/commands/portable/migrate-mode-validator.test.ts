/** Test cho validateMutualExclusion (logic thuần). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { validateMutualExclusion } from "./migrate-mode-validator.js";

test("không cờ mode → null (hợp lệ)", () => {
	assert.equal(validateMutualExclusion({}), null);
});

test("--install + --reconcile → lỗi", () => {
	const msg = validateMutualExclusion({ install: true, reconcile: true });
	assert.match(msg ?? "", /--install.*--reconcile/);
});

test("--reinstall-empty-dirs + --respect-deletions → lỗi", () => {
	const msg = validateMutualExclusion({ reinstallEmptyDirs: true, respectDeletions: true });
	assert.match(msg ?? "", /--reinstall-empty-dirs.*--respect-deletions/);
});

test("chỉ --install → null", () => {
	assert.equal(validateMutualExclusion({ install: true }), null);
});

test("chỉ --reconcile → null", () => {
	assert.equal(validateMutualExclusion({ reconcile: true }), null);
});
