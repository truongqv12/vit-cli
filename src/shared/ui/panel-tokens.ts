// Các token vẽ panel: ký tự khung box, đo chiều rộng visible, ngắt dòng, padding.
// File THUẦN — không I/O, không import logger, an toàn dùng trong test.
// Port từ ck tokens.ts, bỏ formatCdHint/formatDisplayPath (YAGNI ở phase này).

import pc from "picocolors";
import type { CliDesignContext } from "./ui-capabilities.js";

// --- Ký tự khung box ---

export interface BoxChars {
	/** Góc trên-trái */
	tl: string;
	/** Góc trên-phải */
	tr: string;
	/** Góc dưới-trái */
	bl: string;
	/** Góc dưới-phải */
	br: string;
	/** Đường ngang */
	h: string;
	/** Đường dọc */
	v: string;
	/** Dấu đầu dòng */
	bullet: string;
}

/** Ký tự Unicode đẹp — dùng khi terminal hỗ trợ */
export const UNICODE_BOX: BoxChars = {
	tl: "╔",
	tr: "╗",
	bl: "╚",
	br: "╝",
	h: "═",
	v: "║",
	bullet: "●",
};

/** Ký tự ASCII thuần — fallback cho terminal cũ/CI */
export const ASCII_BOX: BoxChars = {
	tl: "+",
	tr: "+",
	bl: "+",
	br: "+",
	h: "-",
	v: "|",
	bullet: "+",
};

// --- Đo chiều rộng visible (bỏ qua ANSI escape) ---

/**
 * Xoá toàn bộ ANSI escape sequence khỏi chuỗi,
 * giữ lại ký tự hiển thị để đo hoặc cắt.
 */
export function stripAnsi(value: string): string {
	let result = "";
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i);
		// Bắt đầu escape sequence ESC (0x1b = 27)
		if (code !== 27) {
			result += value[i];
			continue;
		}
		const next = value[i + 1];
		if (next === "[") {
			// CSI sequence: ESC [ ... <final byte 0x40-0x7e>
			i += 2;
			while (i < value.length) {
				const ch = value.charCodeAt(i);
				if (ch >= 0x40 && ch <= 0x7e) break;
				i += 1;
			}
			continue;
		}
		if (next === "]") {
			// OSC sequence: ESC ] ... BEL hoặc ST (ESC \)
			i += 2;
			while (i < value.length) {
				if (value.charCodeAt(i) === 7) break;
				if (value.charCodeAt(i) === 27 && value[i + 1] === "\\") {
					i += 1;
					break;
				}
				i += 1;
			}
			continue;
		}
		if (next !== undefined) i += 1;
	}
	return result;
}

/**
 * Số ký tự visible (sau khi loại ANSI).
 * Chuẩn hoá NFC + đếm theo code point để dấu tiếng Việt tổ hợp (NFD, vd "ệ"=e+◌̂+◌̣)
 * tính đúng 1 ký tự — tránh lệch viền panel với dữ liệu động (tên file/path từ macOS).
 */
export function visibleWidth(value: string): number {
	return [...stripAnsi(value).normalize("NFC")].length;
}

/** Pad phải bằng khoảng trắng đến đúng `width` visible */
export function padVisible(value: string, width: number): string {
	const padding = Math.max(0, width - visibleWidth(value));
	return `${value}${" ".repeat(padding)}`;
}

/**
 * Cắt giữa chuỗi plain-text về `width`, thêm `...` ở giữa.
 * Đầu vào phải là plain text — ANSI trong input sẽ làm lệch offset.
 */
export function truncateMiddle(value: string, width: number): string {
	if (width <= 0) return "";
	// Chuẩn hoá NFC để slice theo code-unit khớp với phép đo visibleWidth
	value = value.normalize("NFC");
	if (visibleWidth(value) <= width) return value;
	if (width <= 3) return ".".repeat(width);
	const keep = width - 3;
	const front = Math.ceil(keep / 2);
	const back = Math.floor(keep / 2);
	return `${value.slice(0, front)}...${value.slice(value.length - back)}`;
}

/**
 * Ngắt `value` thành nhiều dòng, mỗi dòng ≤ `width` visible.
 * Ngắt theo khoảng trắng; từ dài hơn width được cắt cưỡng bức.
 */
export function wrapText(value: string, width: number): string[] {
	if (width <= 0) return [""];
	// Chuẩn hoá NFC để slice từ dài khớp với phép đo visibleWidth
	const words = value.normalize("NFC").split(/\s+/).filter(Boolean);
	if (words.length === 0) return [""];

	const lines: string[] = [];
	let current = "";

	for (const word of words) {
		const candidate = current.length === 0 ? word : `${current} ${word}`;
		if (visibleWidth(candidate) <= width) {
			current = candidate;
			continue;
		}
		if (current.length > 0) {
			lines.push(current);
			current = "";
		}
		if (visibleWidth(word) <= width) {
			current = word;
			continue;
		}
		// Từ dài — cắt cưỡng bức
		let remaining = word;
		while (visibleWidth(remaining) > width) {
			lines.push(`${remaining.slice(0, Math.max(1, width - 3))}...`);
			remaining = remaining.slice(Math.max(1, width - 3));
		}
		current = remaining;
	}

	if (current.length > 0) lines.push(current);
	return lines;
}

// --- Tô màu theo ngữ cảnh ---

type PaintTone = "accent" | "muted" | "success" | "warning" | "heading";

/**
 * Tô màu `value` theo `tone` nếu context cho phép màu.
 * Trả về chuỗi gốc khi `context.useColor === false`.
 */
export function paint(value: string, tone: PaintTone, context: CliDesignContext): string {
	if (!context.useColor) return value;
	switch (tone) {
		case "accent":
			return pc.cyan(value);
		case "muted":
			return pc.dim(value);
		case "success":
			return pc.green(value);
		case "warning":
			return pc.yellow(value);
		case "heading":
			return pc.bold(value);
	}
}
