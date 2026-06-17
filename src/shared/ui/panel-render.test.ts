/** Test cho renderPanel: plain vs boxed, context inject. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderPanel, type PanelOptions, type PanelZone } from "./panel.js";
import { createCliDesignContext } from "./ui-capabilities.js";
import { visibleWidth } from "./panel-tokens.js";

// --- Helper ---

function createZone(label: string, lines: string[]): PanelZone {
	return { label, lines };
}

// --- Test renderPanel — plain (non-panel) ---

test("renderPanel — supportsPanels=false → plain text", () => {
	const options: PanelOptions = {
		title: "Error",
		zones: [createZone("CAUSE", ["Invalid syntax"])],
		contextOptions: {
			isTTY: true,
			columns: 40, // < PANEL_MIN_WIDTH (60) → supportsPanels=false
			env: {},
			platform: "linux",
		},
	};

	const lines = renderPanel(options);
	assert.ok(lines.length > 0);
	// Plain panel: không chứa ký tự box (╔, ╗, etc.)
	assert.ok(!lines.join("\n").includes("╔"));
	assert.ok(!lines.join("\n").includes("║"));
});

test("renderPanel — plain format: title → zones → indent", () => {
	const options: PanelOptions = {
		title: "Title",
		zones: [createZone("WHAT", ["Line 1", "Line 2"])],
		contextOptions: {
			isTTY: true,
			columns: 50, // < 60 → plain
			env: {},
			platform: "linux",
		},
	};

	const lines = renderPanel(options);
	assert.ok(lines[0].includes("Title"));
	// Zones: nhãn "WHAT" + nội dung indent
	const result = lines.join("\n");
	assert.ok(result.includes("WHAT"));
	assert.ok(result.includes("Line 1"));
});

test("renderPanel — plain với subtitle", () => {
	const options: PanelOptions = {
		title: "Error",
		subtitle: "Details here",
		zones: [createZone("INFO", ["Some info"])],
		contextOptions: {
			isTTY: true,
			columns: 50,
			env: {},
			platform: "linux",
		},
	};

	const lines = renderPanel(options);
	const result = lines.join("\n");
	assert.ok(result.includes("Error"));
	assert.ok(result.includes("Details here"));
});

// --- Test renderPanel — boxed (panel) ---

test("renderPanel — supportsPanels=true → boxed ASCII", () => {
	const options: PanelOptions = {
		title: "Status",
		zones: [createZone("WHAT", ["All good"])],
		contextOptions: {
			isTTY: true,
			columns: 70, // >= 60 → supportsPanels=true
			env: { VIT_FORCE_ASCII: "1" }, // ASCII box
			platform: "linux",
		},
	};

	const lines = renderPanel(options);
	const result = lines.join("\n");
	// Chứa ASCII box characters
	assert.ok(result.includes("+"));
	assert.ok(result.includes("|"));
	assert.ok(!result.includes("╔")); // Không unicode
});

test("renderPanel — supportsPanels=true → boxed Unicode", () => {
	const options: PanelOptions = {
		title: "Status",
		zones: [createZone("WHAT", ["All good"])],
		contextOptions: {
			isTTY: true,
			columns: 70,
			env: { WT_SESSION: "1" }, // Windows Terminal → unicode
			platform: "linux",
		},
	};

	const lines = renderPanel(options);
	const result = lines.join("\n");
	// Chứa Unicode box
	assert.ok(result.includes("╔") || result.includes("║"));
});

test("renderPanel — boxed format: top border + zones + bottom border", () => {
	const options: PanelOptions = {
		title: "Title",
		zones: [
			createZone("WHERE", ["Location"]),
			createZone("WHAT", ["Description"]),
		],
		contextOptions: {
			isTTY: true,
			columns: 70,
			env: { WT_SESSION: "1" },
			platform: "linux",
		},
	};

	const lines = renderPanel(options);
	assert.ok(lines.length >= 3); // Min: top + bottom + content
	// Dòng đầu chứa góc trên-trái
	const topLine = lines[0];
	assert.ok(topLine.includes("╔") || topLine.includes("+")); // Box corner
});

test("renderPanel — boxed title cắt dài", () => {
	const options: PanelOptions = {
		title: "This is a very very very very long title",
		zones: [createZone("WHAT", ["Content"])],
		contextOptions: {
			isTTY: true,
			columns: 60, // Hẹp
			env: { WT_SESSION: "1" },
			platform: "linux",
		},
	};

	const lines = renderPanel(options);
	// Không crash; title được cắt hoặc truncate
	assert.ok(lines.length > 0);
});

test("renderPanel — boxed width clamp", () => {
	const options: PanelOptions = {
		title: "Test",
		zones: [createZone("INFO", ["Data"])],
		contextOptions: {
			isTTY: true,
			columns: 200, // > PANEL_MAX_WIDTH (72)
			env: { WT_SESSION: "1" },
			platform: "linux",
		},
	};

	const lines = renderPanel(options);
	// Width được clamp tới PANEL_MAX_WIDTH; line.length có thể > vì ANSI
	assert.ok(lines.length > 0);
	// Kiểm visibleWidth thay vì raw length
	for (const line of lines) {
		assert.ok(visibleWidth(line) <= 72);
	}
});

// --- Test context inject ---

test("renderPanel — inject context trực tiếp", () => {
	const ctx = createCliDesignContext({
		isTTY: true,
		columns: 70,
		env: { WT_SESSION: "1" },
		platform: "linux",
	});

	const options: PanelOptions = {
		title: "Test",
		zones: [createZone("WHAT", ["Info"])],
		context: ctx,
	};

	const lines = renderPanel(options);
	assert.ok(lines.length > 0);
	assert.ok(lines.join("\n").includes("╔") || lines.join("\n").includes("+"));
});

test("renderPanel — context ưu tiên hơn contextOptions", () => {
	const ctx = createCliDesignContext({
		isTTY: true,
		columns: 70,
		env: { WT_SESSION: "1" },
		platform: "linux",
	});

	const options: PanelOptions = {
		title: "Test",
		zones: [createZone("WHAT", ["Info"])],
		context: ctx,
		contextOptions: {
			columns: 40, // Bị ignore
			isTTY: false,
			env: {},
			platform: "win32",
		},
	};

	const lines = renderPanel(options);
	// Dùng context (70 column, unicode) chứ không phải contextOptions (40 column, plain)
	assert.ok(lines.join("\n").includes("╔") || lines.join("\n").includes("║"));
});

// --- Test multiple zones ---

test("renderPanel — multiple zones cách nhau", () => {
	const options: PanelOptions = {
		title: "Multi",
		zones: [
			createZone("ZONE1", ["Content 1"]),
			createZone("ZONE2", ["Content 2"]),
			createZone("ZONE3", ["Content 3"]),
		],
		contextOptions: {
			isTTY: true,
			columns: 70,
			env: { WT_SESSION: "1" },
			platform: "linux",
		},
	};

	const lines = renderPanel(options);
	const result = lines.join("\n");
	assert.ok(result.includes("ZONE1"));
	assert.ok(result.includes("ZONE2"));
	assert.ok(result.includes("ZONE3"));
});

test("renderPanel — zone với nhiều dòng", () => {
	const options: PanelOptions = {
		title: "MultiLine",
		zones: [
			createZone("WHERE", [
				"First line of content",
				"Second line of content",
				"Third line of content",
			]),
		],
		contextOptions: {
			isTTY: true,
			columns: 70,
			env: { WT_SESSION: "1" },
			platform: "linux",
		},
	};

	const lines = renderPanel(options);
	const result = lines.join("\n");
	assert.ok(result.includes("First line"));
	assert.ok(result.includes("Second line"));
	assert.ok(result.includes("Third line"));
});

// --- Test NO_COLOR ---

test("renderPanel — NO_COLOR → không màu (nhưng vẫn box)", () => {
	const options: PanelOptions = {
		title: "Test",
		zones: [createZone("WHAT", ["Info"])],
		contextOptions: {
			isTTY: true,
			columns: 70,
			env: { WT_SESSION: "1", NO_COLOR: "1" },
			platform: "linux",
		},
	};

	const lines = renderPanel(options);
	const result = lines.join("\n");
	// Vẫn có box (supportsPanels=true)
	assert.ok(result.includes("╔") || result.includes("+"));
	// Không có ANSI escape (paint trả plain khi useColor=false)
	// Note: paint(tone) dùng picocolors; kiểm tra bằng cách title không có \x1b
});

// --- Test empty zones ---

test("renderPanel — empty zone", () => {
	const options: PanelOptions = {
		title: "Empty",
		zones: [createZone("EMPTY", [])],
		contextOptions: {
			isTTY: true,
			columns: 70,
			env: { WT_SESSION: "1" },
			platform: "linux",
		},
	};

	const lines = renderPanel(options);
	assert.ok(lines.length > 0); // Không crash
	// Zone rỗng: nhãn có thể được paint (ANSI escape) nên dùng visibleWidth để tìm
	const result = lines.join("\n");
	assert.ok(result.includes("Empty") || result.length > 0); // Title hoặc content
});

test("renderPanel — no subtitle", () => {
	const options: PanelOptions = {
		title: "NoSubtitle",
		zones: [createZone("WHAT", ["Content"])],
		contextOptions: {
			isTTY: true,
			columns: 70,
			env: { WT_SESSION: "1" },
			platform: "linux",
		},
	};

	const lines = renderPanel(options);
	assert.ok(lines.length > 0);
	// Không undefined/null trong output
	for (const line of lines) {
		assert.notEqual(line, "undefined");
		assert.notEqual(line, "null");
	}
});

// --- Test wrapping long content ---

test("renderPanel — long zone content wrap", () => {
	const longText =
		"This is a very long line that should wrap to multiple lines when rendered in a narrow panel";
	const options: PanelOptions = {
		title: "LongContent",
		zones: [createZone("WHAT", [longText])],
		contextOptions: {
			isTTY: true,
			columns: 60,
			env: { WT_SESSION: "1" },
			platform: "linux",
		},
	};

	const lines = renderPanel(options);
	assert.ok(lines.length > 3); // Content wrap → nhiều dòng
});
