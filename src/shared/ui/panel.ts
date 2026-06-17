// Render panel box hoặc plain text tùy theo capability terminal.
// File THUẦN — trả string[], không ghi stdout, không import logger.
// Port từ ck panel.ts, đổi import path sang ui-capabilities + panel-tokens.

import {
	type CliDesignContext,
	type CliDesignContextOptions,
	createCliDesignContext,
} from "./ui-capabilities.js";
import {
	type BoxChars,
	padVisible,
	paint,
	truncateMiddle,
	visibleWidth,
	wrapText,
} from "./panel-tokens.js";

// --- Interface công khai ---

/** Một vùng nội dung trong panel, có nhãn và danh sách dòng */
export interface PanelZone {
	/** Nhãn hiển thị (ví dụ: "WHERE", "WHAT", "NEXT") */
	label: string;
	/** Các dòng nội dung trong vùng này */
	lines: string[];
}

/** Tham số đầu vào cho renderPanel */
export interface PanelOptions {
	/** Context đã tạo sẵn (ưu tiên nếu có) */
	context?: CliDesignContext;
	/** Options để tạo context tự động khi không có `context` */
	contextOptions?: CliDesignContextOptions;
	/** Dòng phụ đề (muted) bên dưới tiêu đề */
	subtitle?: string;
	/** Tiêu đề panel (in đậm) */
	title: string;
	/** Danh sách vùng nội dung */
	zones: PanelZone[];
}

// --- Hàm render chính ---

/**
 * Render panel thành mảng string[] để caller tự quyết định cách in.
 * Tự chọn kiểu boxed (unicode/ascii) hoặc plain text tùy `context.supportsPanels`.
 */
export function renderPanel(options: PanelOptions): string[] {
	const context = options.context ?? createCliDesignContext(options.contextOptions);
	const title = paint(options.title, "heading", context);
	const subtitle = options.subtitle ? paint(options.subtitle, "muted", context) : null;

	if (!context.supportsPanels) {
		return renderPlainPanel(options.zones, title, subtitle, context);
	}
	return renderBoxedPanel(options.zones, title, subtitle, context);
}

// --- Render plain (terminal hẹp hoặc non-TTY) ---

function renderPlainPanel(
	zones: PanelZone[],
	title: string,
	subtitle: string | null,
	context: CliDesignContext,
): string[] {
	const lines = [title];
	if (subtitle) lines.push(subtitle);
	lines.push("");

	for (const zone of zones) {
		lines.push(paint(zone.label, "accent", context));
		for (const line of zone.lines) {
			// Thụt lề 2 khoảng trắng cho nội dung
			lines.push(...wrapText(line, context.width - 2).map((entry) => `  ${entry}`));
		}
		lines.push("");
	}

	return trimTrailingBlank(lines);
}

// --- Render boxed (unicode hoặc ascii box) ---

function renderBoxedPanel(
	zones: PanelZone[],
	title: string,
	subtitle: string | null,
	context: CliDesignContext,
): string[] {
	// Tính độ rộng nhãn: tối thiểu 4, tối đa 12, bằng nhãn dài nhất
	const labelWidth = Math.min(12, Math.max(...zones.map((z) => z.label.length), 4));
	const innerWidth = context.width - 4; // trừ 2 cột border + 2 khoảng trắng padding

	const lines: string[] = [renderTopBorder(title, context.box, context.width)];

	if (subtitle) {
		lines.push(renderContentLine(subtitle, innerWidth, context.box));
		lines.push(renderContentLine("", innerWidth, context.box));
	}

	for (const [index, zone] of zones.entries()) {
		for (const line of formatZone(zone, labelWidth, innerWidth, context)) {
			lines.push(renderContentLine(line, innerWidth, context.box));
		}
		// Dòng trống ngăn cách giữa các zone (trừ zone cuối)
		if (index < zones.length - 1) {
			lines.push(renderContentLine("", innerWidth, context.box));
		}
	}

	lines.push(renderBottomBorder(context.box, context.width));
	return lines;
}

// --- Các hàm render phụ trợ ---

/**
 * Format nội dung một zone thành mảng dòng có prefix nhãn.
 * Dòng đầu có nhãn, các dòng tiếp theo thụt lề tương đương.
 */
function formatZone(
	zone: PanelZone,
	labelWidth: number,
	innerWidth: number,
	context: CliDesignContext,
): string[] {
	// Chiều rộng khả dụng cho nội dung: trừ nhãn, dấu phân cách, khoảng trắng
	const availableWidth = Math.max(8, innerWidth - labelWidth - 3);
	const label = paint(zone.label, "accent", context);
	const rendered: string[] = [];

	for (const [lineIndex, rawLine] of zone.lines.entries()) {
		const wrappedLines = wrapText(rawLine, availableWidth);
		for (const [wrapIndex, wrappedLine] of wrappedLines.entries()) {
			// Chỉ hiển thị nhãn ở dòng đầu tiên của mục đầu tiên
			const prefix =
				lineIndex === 0 && wrapIndex === 0 ? padVisible(label, labelWidth) : " ".repeat(labelWidth);
			rendered.push(` ${prefix} ${wrappedLine}`);
		}
	}

	return rendered;
}

/** Vẽ border trên với tiêu đề nhúng vào */
function renderTopBorder(title: string, box: BoxChars, width: number): string {
	const availableWidth = width - 2;
	const decorationWidth = 3; // "h + space + space"
	const maxTitleWidth = Math.max(1, availableWidth - decorationWidth - 1);
	// Cắt tiêu đề nếu quá dài để không vỡ border
	const safeTitle =
		visibleWidth(title) > maxTitleWidth ? truncateMiddle(title, maxTitleWidth) : title;
	const heading = `${box.h} ${safeTitle} `;
	const fill = Math.max(1, availableWidth - visibleWidth(heading));
	return `${box.tl}${heading}${box.h.repeat(fill)}${box.tr}`;
}

/** Vẽ border dưới */
function renderBottomBorder(box: BoxChars, width: number): string {
	return `${box.bl}${box.h.repeat(width - 2)}${box.br}`;
}

/** Bọc một dòng nội dung bằng ký tự border hai bên */
function renderContentLine(content: string, width: number, box: BoxChars): string {
	return `${box.v} ${padVisible(content, width)} ${box.v}`;
}

/** Xoá các dòng trống trailing cuối mảng */
function trimTrailingBlank(lines: string[]): string[] {
	const trimmed = [...lines];
	while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "") {
		trimmed.pop();
	}
	return trimmed;
}
