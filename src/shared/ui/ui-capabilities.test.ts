/** Test cho createCliDesignContext và supportsUnicode (logic thuần). */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	createCliDesignContext,
	supportsUnicode,
	PANEL_MIN_WIDTH,
	PANEL_MAX_WIDTH,
} from "./ui-capabilities.js";

// --- Test supportsUnicode ---

test("supportsUnicode — VIT_FORCE_ASCII=1 → không unicode", () => {
	const result = supportsUnicode({
		env: { VIT_FORCE_ASCII: "1" },
		isTTY: true,
		platform: "linux",
	});
	assert.equal(result, false);
});

test("supportsUnicode — CK_FORCE_ASCII=1 → không unicode", () => {
	const result = supportsUnicode({
		env: { CK_FORCE_ASCII: "1" },
		isTTY: true,
		platform: "linux",
	});
	assert.equal(result, false);
});

test("supportsUnicode — VIT_FORCE_ASCII ưu tiên hơn CK_FORCE_ASCII", () => {
	const result = supportsUnicode({
		env: { VIT_FORCE_ASCII: "1", CK_FORCE_ASCII: "0" },
		isTTY: true,
		platform: "linux",
	});
	assert.equal(result, false);
});

test("supportsUnicode — VIT_NO_UNICODE=1 → không unicode", () => {
	const result = supportsUnicode({
		env: { VIT_NO_UNICODE: "1" },
		isTTY: true,
		platform: "linux",
	});
	assert.equal(result, false);
});

test("supportsUnicode — NO_UNICODE=1 → không unicode", () => {
	const result = supportsUnicode({
		env: { NO_UNICODE: "1" },
		isTTY: true,
		platform: "linux",
	});
	assert.equal(result, false);
});

test("supportsUnicode — TERM=dumb → không unicode", () => {
	const result = supportsUnicode({
		env: { TERM: "dumb" },
		isTTY: true,
		platform: "linux",
	});
	assert.equal(result, false);
});

test("supportsUnicode — WT_SESSION (Windows Terminal) → unicode", () => {
	const result = supportsUnicode({
		env: { WT_SESSION: "12345" },
		isTTY: false,
		platform: "win32",
	});
	assert.equal(result, true);
});

test("supportsUnicode — CI=true → unicode", () => {
	const result = supportsUnicode({
		env: { CI: "true" },
		isTTY: false,
		platform: "linux",
	});
	assert.equal(result, true);
});

test("supportsUnicode — CI=1 → unicode", () => {
	const result = supportsUnicode({
		env: { CI: "1" },
		isTTY: false,
		platform: "linux",
	});
	assert.equal(result, true);
});

test("supportsUnicode — non-TTY mà không CI/WT → ASCII", () => {
	const result = supportsUnicode({
		env: {},
		isTTY: false,
		platform: "linux",
	});
	assert.equal(result, false);
});

test("supportsUnicode — iTerm → unicode", () => {
	const result = supportsUnicode({
		env: { TERM_PROGRAM: "iTerm.app" },
		isTTY: true,
		platform: "darwin",
	});
	assert.equal(result, true);
});

test("supportsUnicode — Apple_Terminal → unicode", () => {
	const result = supportsUnicode({
		env: { TERM_PROGRAM: "Apple_Terminal" },
		isTTY: true,
		platform: "darwin",
	});
	assert.equal(result, true);
});

test("supportsUnicode — vscode → unicode", () => {
	const result = supportsUnicode({
		env: { TERM_PROGRAM: "vscode" },
		isTTY: true,
		platform: "linux",
	});
	assert.equal(result, true);
});

test("supportsUnicode — KONSOLE_VERSION → unicode", () => {
	const result = supportsUnicode({
		env: { KONSOLE_VERSION: "210800" },
		isTTY: true,
		platform: "linux",
	});
	assert.equal(result, true);
});

test("supportsUnicode — locale UTF-8 → unicode", () => {
	const result = supportsUnicode({
		env: { LANG: "en_US.UTF-8" },
		isTTY: true,
		platform: "linux",
	});
	assert.equal(result, true);
});

test("supportsUnicode — win32 mặc định → ASCII", () => {
	const result = supportsUnicode({
		env: {},
		isTTY: true,
		platform: "win32",
	});
	assert.equal(result, false);
});

test("supportsUnicode — TTY + unknown terminal → unicode (fallback)", () => {
	const result = supportsUnicode({
		env: {},
		isTTY: true,
		platform: "linux",
	});
	assert.equal(result, true);
});

// --- Test createCliDesignContext ---

test("createCliDesignContext — mặc định (inject)", () => {
	const ctx = createCliDesignContext({
		isTTY: true,
		columns: 80,
		env: {},
		platform: "linux",
	});
	assert.ok(ctx.box);
	assert.equal(ctx.platform, "linux");
	assert.equal(ctx.rawWidth, 80);
	assert.equal(ctx.width, 72); // Clamp tới PANEL_MAX_WIDTH
	assert.equal(ctx.supportsPanels, true);
	assert.equal(ctx.useColor, true); // TTY + không NO_COLOR
});

test("createCliDesignContext — width < PANEL_MIN_WIDTH → supportsPanels=false", () => {
	const ctx = createCliDesignContext({
		isTTY: true,
		columns: 50, // < 60 (PANEL_MIN_WIDTH)
		env: {},
		platform: "linux",
	});
	assert.equal(ctx.supportsPanels, false);
	assert.equal(ctx.width, 50); // Nhưng width giữ nguyên (min 40)
});

test("createCliDesignContext — width < 40 → clamp tới 40", () => {
	const ctx = createCliDesignContext({
		isTTY: true,
		columns: 20,
		env: {},
		platform: "linux",
	});
	assert.equal(ctx.width, 40); // Clamp min
});

test("createCliDesignContext — width > PANEL_MAX_WIDTH → clamp tới 72", () => {
	const ctx = createCliDesignContext({
		isTTY: true,
		columns: 200,
		env: {},
		platform: "linux",
	});
	assert.equal(ctx.width, 72); // Clamp max
});

test("createCliDesignContext — unicode box khi supportUnicode=true", () => {
	const ctx = createCliDesignContext({
		isTTY: true,
		columns: 80,
		env: { WT_SESSION: "1" }, // Windows Terminal → unicode
		platform: "linux",
	});
	assert.equal(ctx.box.h, "═"); // Unicode box
	assert.equal(ctx.box.v, "║");
});

test("createCliDesignContext — ASCII box khi supportUnicode=false", () => {
	const ctx = createCliDesignContext({
		isTTY: true,
		columns: 80,
		env: { VIT_FORCE_ASCII: "1" },
		platform: "linux",
	});
	assert.equal(ctx.box.h, "-"); // ASCII box
	assert.equal(ctx.box.v, "|");
});

test("createCliDesignContext — NO_COLOR → useColor=false", () => {
	const ctx = createCliDesignContext({
		isTTY: true,
		columns: 80,
		env: { NO_COLOR: "1" },
		platform: "linux",
	});
	assert.equal(ctx.useColor, false);
});

test("createCliDesignContext — non-TTY → useColor=false", () => {
	const ctx = createCliDesignContext({
		isTTY: false,
		columns: 80,
		env: {},
		platform: "linux",
	});
	assert.equal(ctx.useColor, false);
});

test("createCliDesignContext — rawWidth tư nhân nhập", () => {
	const ctx = createCliDesignContext({
		isTTY: true,
		columns: 65,
		env: {},
		platform: "linux",
	});
	assert.equal(ctx.rawWidth, 65);
});

test("createCliDesignContext — default columns khi không inject", () => {
	const ctx = createCliDesignContext({
		env: {},
		platform: "linux",
		isTTY: true,
	});
	// Không inject columns → mặc định PANEL_MAX_WIDTH
	assert.equal(ctx.width, 72);
});

test("createCliDesignContext — width tính supportsPanels", () => {
	const ctxSmall = createCliDesignContext({
		isTTY: true,
		columns: 59, // < PANEL_MIN_WIDTH (60)
		env: {},
		platform: "linux",
	});
	assert.equal(ctxSmall.supportsPanels, false);

	const ctxLarge = createCliDesignContext({
		isTTY: true,
		columns: 60, // >= PANEL_MIN_WIDTH
		env: {},
		platform: "linux",
	});
	assert.equal(ctxLarge.supportsPanels, true);
});
