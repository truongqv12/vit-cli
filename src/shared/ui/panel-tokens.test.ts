/** Test cho panel-tokens: stripAnsi, visibleWidth, padVisible, truncateMiddle, wrapText. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	stripAnsi,
	visibleWidth,
	padVisible,
	truncateMiddle,
	wrapText,
	UNICODE_BOX,
	ASCII_BOX,
} from "./panel-tokens.js";

// --- Test stripAnsi ---

test("stripAnsi — plain text không ANSI → giữ nguyên", () => {
	const result = stripAnsi("hello");
	assert.equal(result, "hello");
});

test("stripAnsi — CSI sequence (mã màu) → xoá", () => {
	const result = stripAnsi("hello\x1b[31mworld\x1b[0m");
	assert.equal(result, "helloworld");
});

test("stripAnsi — bold/dim → xoá", () => {
	const result = stripAnsi("hello\x1b[1mbold\x1b[0m");
	assert.equal(result, "hellobold");
});

test("stripAnsi — OSC sequence → xoá", () => {
	const result = stripAnsi("hello\x1b]title\x07world");
	assert.equal(result, "helloworld");
});

test("stripAnsi — rỗng → rỗng", () => {
	const result = stripAnsi("");
	assert.equal(result, "");
});

test("stripAnsi — chỉ ANSI → rỗng", () => {
	const result = stripAnsi("\x1b[31m\x1b[0m");
	assert.equal(result, "");
});

// --- Test visibleWidth ---

test("visibleWidth — plain text", () => {
	assert.equal(visibleWidth("hello"), 5);
});

test("visibleWidth — text với ANSI", () => {
	assert.equal(visibleWidth("hello\x1b[31mworld\x1b[0m"), 10); // "helloworld" = 10
});

test("visibleWidth — rỗng", () => {
	assert.equal(visibleWidth(""), 0);
});

test("visibleWidth — unicode character", () => {
	assert.equal(visibleWidth("你好"), 2);
});

// --- Test padVisible ---

test("padVisible — không cần pad", () => {
	const result = padVisible("hello", 5);
	assert.equal(result, "hello");
});

test("padVisible — cần pad", () => {
	const result = padVisible("hello", 10);
	assert.equal(result, "hello     "); // +5 spaces
});

test("padVisible — với ANSI → tính visible width", () => {
	const result = padVisible("hello\x1b[31mworld\x1b[0m", 15);
	// visibleWidth = 10, cần pad 5
	assert.equal(visibleWidth(result), 15);
});

test("padVisible — width=0", () => {
	const result = padVisible("hello", 0);
	assert.equal(result, "hello"); // Không pad (width < visibleWidth)
});

test("padVisible — rỗng", () => {
	const result = padVisible("", 5);
	assert.equal(result, "     "); // 5 spaces
});

// --- Test truncateMiddle ---

test("truncateMiddle — text ngắn hơn width", () => {
	const result = truncateMiddle("hello", 10);
	assert.equal(result, "hello");
});

test("truncateMiddle — text dài bằng width", () => {
	const result = truncateMiddle("hello", 5);
	assert.equal(result, "hello");
});

test("truncateMiddle — cắt giữa", () => {
	const result = truncateMiddle("hello", 3);
	// width=3: keep=0, không thể giữ gì → "..."
	assert.match(result, /\.\.\./);
});

test("truncateMiddle — width <= 3 → chỉ dots", () => {
	const result = truncateMiddle("verylongtext", 3);
	assert.equal(result, "...");
});

test("truncateMiddle — width <= 0 → rỗng", () => {
	const result = truncateMiddle("hello", 0);
	assert.equal(result, "");
});

test("truncateMiddle — dài, cắt đều", () => {
	const result = truncateMiddle("abcdefghij", 8);
	// width=8: keep=5, front=3, back=2
	// Kết quả: "abc...ij" hoặc "abcd...j"
	assert.match(result, /\.\.\./);
	assert.ok(visibleWidth(result) <= 8);
});

// --- Test wrapText ---

test("wrapText — text ngắn hơn width", () => {
	const result = wrapText("hello", 10);
	assert.deepEqual(result, ["hello"]);
});

test("wrapText — text dài, break theo space", () => {
	const result = wrapText("hello world foo", 10);
	assert.ok(result.length > 1); // Chia nhiều dòng
	for (const line of result) {
		assert.ok(visibleWidth(line) <= 10);
	}
});

test("wrapText — width=1 → từng ký tự (nếu tách được)", () => {
	const result = wrapText("ab cd", 1);
	// width=1 quá nhỏ → logic cắt cưỡng bức: nếu from > width-3 → "..."
	// "ab" (2) > 1 → cắt, width-3 = -2 (max 1) → cắt 1 ký tự: "a..."
	assert.ok(result.length > 0); // Không empty
	for (const line of result) {
		// Các dòng có thể là "..." (3 ký tự) hoặc 1 ký tự
		assert.ok(visibleWidth(line) >= 1);
	}
});

test("wrapText — width <= 0 → rỗng", () => {
	const result = wrapText("hello", 0);
	assert.deepEqual(result, [""]);
});

test("wrapText — rỗng → rỗng", () => {
	const result = wrapText("", 10);
	assert.deepEqual(result, [""]);
});

test("wrapText — chỉ spaces → rỗng (sau filter)", () => {
	const result = wrapText("   ", 10);
	assert.deepEqual(result, [""]);
});

test("wrapText — từ dài hơn width", () => {
	const result = wrapText("verylongword", 5);
	// Từ "verylongword" (12 ký tự) > width (5) → cắt cưỡng bức
	assert.ok(result.length > 0);
	for (const line of result) {
		assert.ok(visibleWidth(line) <= 5 || visibleWidth(line) === 3); // hoặc "..."
	}
});

test("wrapText — multiple spaces giữa từ", () => {
	const result = wrapText("hello    world", 20);
	// split(/\s+/) → ["hello", "world"] (spaces loại)
	assert.ok(result.length > 0);
});

// --- Test BOX characters ---

test("UNICODE_BOX — chứa ký tự unicode", () => {
	assert.equal(UNICODE_BOX.tl, "╔");
	assert.equal(UNICODE_BOX.tr, "╗");
	assert.equal(UNICODE_BOX.bl, "╚");
	assert.equal(UNICODE_BOX.br, "╝");
	assert.equal(UNICODE_BOX.h, "═");
	assert.equal(UNICODE_BOX.v, "║");
	assert.equal(UNICODE_BOX.bullet, "●");
});

test("ASCII_BOX — chứa ký tự ASCII", () => {
	assert.equal(ASCII_BOX.tl, "+");
	assert.equal(ASCII_BOX.tr, "+");
	assert.equal(ASCII_BOX.bl, "+");
	assert.equal(ASCII_BOX.br, "+");
	assert.equal(ASCII_BOX.h, "-");
	assert.equal(ASCII_BOX.v, "|");
	assert.equal(ASCII_BOX.bullet, "+");
});

// --- Test integration: stripAnsi + visibleWidth + padVisible ---

test("integration — padVisible với ANSI + truncateMiddle", () => {
	const colored = "hello\x1b[31mworld\x1b[0m";
	const padded = padVisible(colored, 20);
	assert.equal(visibleWidth(padded), 20);
});

test("integration — wrapText không chứa ANSI", () => {
	const text = "hello world foo bar baz";
	const lines = wrapText(text, 10);
	for (const line of lines) {
		// Không ANSI trong input → output cũng không
		assert.equal(stripAnsi(line), line);
	}
});

test("padVisible — negative padding (width < visibleWidth)", () => {
	const result = padVisible("hello", 3);
	assert.equal(result, "hello"); // Không cắt, chỉ không pad
});

test("wrapText — sentence với punctuation", () => {
	const result = wrapText("Hello, world! How are you?", 15);
	assert.ok(result.length > 0);
	for (const line of result) {
		assert.ok(visibleWidth(line) <= 15);
	}
});

test("truncateMiddle — plain ascii", () => {
	const result = truncateMiddle("abcdefghij", 7);
	// width=7: keep=4, front=2, back=2
	// "ab...ij"
	assert.ok(result.includes("..."));
	assert.ok(result.startsWith("ab"));
	assert.ok(result.endsWith("ij"));
});
