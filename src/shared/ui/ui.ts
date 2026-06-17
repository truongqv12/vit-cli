// Barrel export cho toàn bộ lớp UI của Vit CLI.
// Đây là điểm import duy nhất mà các lệnh cần dùng:
//   import { printPanel, intro, outro, createSpinner, createProgress, renderProgressBar } from "../shared/ui/ui.js"
//
// Helper cao cấp: printPanel(), intro(), outro() — bọc logic I/O để caller không cần biết clack/process.stdout.

import * as clack from "@clack/prompts";
import pc from "picocolors";
import { createCliDesignContext } from "./ui-capabilities.js";
import type { CliDesignContextOptions } from "./ui-capabilities.js";
import { renderPanel } from "./panel.js";
import type { PanelOptions } from "./panel.js";

// --- Re-export toàn bộ public API ---

export type { BoxChars } from "./panel-tokens.js";
export {
	stripAnsi,
	visibleWidth,
	padVisible,
	truncateMiddle,
	wrapText,
	paint,
	UNICODE_BOX,
	ASCII_BOX,
} from "./panel-tokens.js";

export type { CliDesignContext, CliDesignContextOptions } from "./ui-capabilities.js";
export {
	createCliDesignContext,
	supportsUnicode,
	PANEL_MIN_WIDTH,
	PANEL_MAX_WIDTH,
} from "./ui-capabilities.js";

export type { PanelZone, PanelOptions } from "./panel.js";
export { renderPanel } from "./panel.js";

export type { SpinnerHandle } from "./spinner.js";
export { createSpinner } from "./spinner.js";

export type { ProgressHandle } from "./progress.js";
export { createProgress, renderProgressBar } from "./progress.js";

// --- Helper cao cấp ---

/**
 * In panel ra stdout ngay lập tức.
 * Tự chọn kiểu boxed/plain dựa trên khả năng terminal.
 *
 * @param options  Cấu hình panel (title, zones, subtitle, context tùy chọn)
 * @param toStderr Ghi ra stderr thay vì stdout (dùng cho panel lỗi để script `2>` bắt được)
 *
 * @example
 * printPanel({
 *   title: "Vit Init",
 *   subtitle: "Khởi tạo dự án",
 *   zones: [
 *     { label: "WHERE", lines: ["~/.vit/skills"] },
 *     { label: "NEXT",  lines: ["vit doctor"] },
 *   ],
 * });
 */
export function printPanel(options: PanelOptions, toStderr = false): void {
	const lines = renderPanel(options);
	(toStderr ? console.error : console.log)(lines.join("\n"));
}

/**
 * In dòng giới thiệu phiên làm việc với branding "Vit".
 * Dùng @clack/prompts intro() để có đường kẻ đẹp trên TTY.
 *
 * @param title  Tiêu đề phiên (mặc định "Vit")
 *
 * @example
 * intro("Vit Init");  // → ◇ Vit Init ─────
 */
export function intro(title = "Vit"): void {
	clack.intro(pc.bold(title));
}

/**
 * In dòng kết thúc phiên làm việc với branding "Vit".
 * Dùng @clack/prompts outro() để có đường kẻ đẹp trên TTY.
 *
 * @param message  Thông điệp kết thúc (mặc định "Xong!")
 *
 * @example
 * outro("Hoàn tất. Chạy `vit doctor` để kiểm tra.");
 */
export function outro(message = "Xong!"): void {
	clack.outro(message);
}

/**
 * Lấy CliDesignContext cho terminal hiện tại (hoặc inject để test).
 * Tiện dụng trong lệnh khi cần kiểm tra nhanh useColor/supportsPanels
 * mà không muốn import sâu vào ui-capabilities.ts.
 *
 * @param options  Tùy chọn inject env/isTTY/columns (dùng trong test)
 *
 * @example
 * const ctx = getContext();
 * if (ctx.supportsPanels) { ... }
 */
export function getContext(options?: CliDesignContextOptions) {
	return createCliDesignContext(options);
}
