/** Test cho renderProgressBar (hàm render thuần). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderProgressBar } from "./progress.js";

test("renderProgressBar — 0%", () => {
	const result = renderProgressBar(0, 100, 24, true);
	assert.match(result, /0%/);
	assert.match(result, /\[░+\]/);
	assert.match(result, /\(0\/100\)/);
});

test("renderProgressBar — 50%", () => {
	const result = renderProgressBar(50, 100, 24, true);
	assert.match(result, /50%/);
	assert.match(result, /[█░]/); // Có cả fill và empty
});

test("renderProgressBar — 100%", () => {
	const result = renderProgressBar(100, 100, 24, true);
	assert.match(result, /100%/);
	assert.match(result, /█+/); // Toàn bộ fill
	assert.match(result, /\(100\/100\)/);
});

test("renderProgressBar — current > total (clamp)", () => {
	const result = renderProgressBar(150, 100, 24, true);
	assert.match(result, /100%/); // Clamped tới 100%
	assert.match(result, /█+/); // Toàn bộ fill
	assert.match(result, /\(100\/100\)/); // Hiển thị 100/100, không 150/100
});

test("renderProgressBar — total=0 (trả rỗng)", () => {
	const result = renderProgressBar(0, 0, 24, true);
	assert.equal(result, "");
});

test("renderProgressBar — total < 0 (trả rỗng)", () => {
	const result = renderProgressBar(50, -10, 24, true);
	assert.equal(result, "");
});

test("renderProgressBar — width=10", () => {
	const result = renderProgressBar(50, 100, 10, true);
	// Chiều rộng bar là 10 ký tự
	assert.match(result, /\[.{10}\]/);
});

test("renderProgressBar — width=1", () => {
	const result = renderProgressBar(50, 100, 1, true);
	assert.match(result, /\[.\]/); // 1 ký tự
});

test("renderProgressBar — unicode (mặc định)", () => {
	const result = renderProgressBar(50, 100, 24, true);
	assert.match(result, /[█░]/); // Unicode block characters
});

test("renderProgressBar — ASCII (useUnicode=false)", () => {
	const result = renderProgressBar(50, 100, 24, false);
	assert.match(result, /[#.]/); // ASCII: # fill, . empty
	assert.doesNotMatch(result, /[█░]/); // Không chứa unicode
});

test("renderProgressBar — 0 byte đã tải", () => {
	const result = renderProgressBar(0, 1000, 24, true);
	assert.match(result, /0%/);
	assert.match(result, /\(0\/1000\)/);
});

test("renderProgressBar — current âm (clamp)", () => {
	const result = renderProgressBar(-50, 100, 24, true);
	assert.match(result, /0%/);
	assert.match(result, /\(0\/100\)/); // Clamped tới 0
});

test("renderProgressBar — tính phần trăm chính xác", () => {
	const result = renderProgressBar(1, 3, 24, true); // 33.33% → floor = 33%
	assert.match(result, /33%/);
});

test("renderProgressBar — 75%", () => {
	const result = renderProgressBar(75, 100, 24, true);
	assert.match(result, /75%/);
	// Khoảng 18 ký tự fill, 6 empty (75% của 24)
	const bar = result.match(/\[([█░]+)\]/);
	assert.ok(bar);
	const filled = bar![1].match(/█/g)?.length ?? 0;
	const empty = bar![1].match(/░/g)?.length ?? 0;
	assert.ok(filled > empty); // Phần fill nhiều hơn
});

test("renderProgressBar — display format", () => {
	const result = renderProgressBar(650, 1537, 24, true);
	// Format: "[████░░░░] 42% (650/1537)"
	assert.match(result, /\[.+\] \d+% \(\d+\/\d+\)/);
});
