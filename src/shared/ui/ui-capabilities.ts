// Phát hiện capability terminal: TTY, unicode, màu, chiều rộng cột.
// File THUẦN — nhận options inject được, không đọc process trực tiếp trong hàm core
// để unit test có thể truyền env/isTTY/columns giả lập mà không cần mock global.

import { ASCII_BOX, UNICODE_BOX, type BoxChars } from "./panel-tokens.js";

// --- Hằng số kích thước panel ---

export const PANEL_MIN_WIDTH = 60;
export const PANEL_MAX_WIDTH = 72;
const DEFAULT_WIDTH = PANEL_MAX_WIDTH;

// --- Interface công khai ---

export interface CliDesignContext {
	/** Bộ ký tự khung box phù hợp (unicode hoặc ascii) */
	box: BoxChars;
	/** Nền tảng hệ điều hành */
	platform: NodeJS.Platform;
	/** Chiều rộng cột thô từ terminal (chưa clamp) */
	rawWidth: number;
	/** Có đủ rộng để vẽ panel box không (>= PANEL_MIN_WIDTH) */
	supportsPanels: boolean;
	/** Có dùng màu ANSI không */
	useColor: boolean;
	/** Chiều rộng đã clamp [40, PANEL_MAX_WIDTH] */
	width: number;
}

export interface CliDesignContextOptions {
	/** Số cột terminal (inject để test) */
	columns?: number;
	/** Biến môi trường (inject để test, mặc định process.env) */
	env?: NodeJS.ProcessEnv;
	/** Có phải TTY không (inject để test) */
	isTTY?: boolean;
	/** Nền tảng (inject để test) */
	platform?: NodeJS.Platform;
}

// --- Phát hiện hỗ trợ unicode ---

/**
 * Quyết định có dùng Unicode không dựa trên env/TTY/platform.
 * Ưu tiên env var VIT_FORCE_ASCII trước CK_FORCE_ASCII (backward compat).
 * Logic cụ thể:
 * - VIT_FORCE_ASCII=1 hoặc CK_FORCE_ASCII=1 → ASCII
 * - VIT_NO_UNICODE=1 hoặc NO_UNICODE=1 → ASCII
 * - TERM=dumb → ASCII
 * - WT_SESSION (Windows Terminal) → Unicode
 * - CI=true|1 → Unicode (CI thường hỗ trợ UTF-8)
 * - non-TTY (không phải WT_SESSION, không CI) → ASCII
 * - Các terminal hiện đại (iTerm, vscode, Apple_Terminal, Konsole) → Unicode
 * - Locale có "utf" → Unicode
 * - win32 mặc định → ASCII (terminal cũ)
 * - Còn lại → Unicode
 */
export function supportsUnicode(options: {
	env: NodeJS.ProcessEnv;
	isTTY: boolean;
	platform: NodeJS.Platform;
}): boolean {
	const { env, isTTY, platform } = options;

	// Cờ buộc ASCII — VIT_ ưu tiên hơn CK_ (backward compat)
	if (env.VIT_FORCE_ASCII === "1" || env.CK_FORCE_ASCII === "1") return false;
	if (env.VIT_NO_UNICODE === "1" || env.NO_UNICODE === "1") return false;

	// Terminal "dumb" không hỗ trợ gì
	if (env.TERM === "dumb") return false;

	// Windows Terminal luôn hỗ trợ Unicode
	if (env.WT_SESSION) return true;

	// Môi trường CI — thường hỗ trợ UTF-8
	const ci = (env.CI ?? "").trim().toLowerCase();
	if (ci === "true" || ci === "1") return true;

	// Non-TTY mà không phải CI/WT → fallback ASCII để tránh ký tự lạ trong pipe
	if (!isTTY) return false;

	// Terminal hiện đại được biết hỗ trợ Unicode
	if (env.TERM_PROGRAM === "iTerm.app") return true;
	if (env.TERM_PROGRAM === "Apple_Terminal") return true;
	if (env.TERM_PROGRAM === "vscode") return true;
	if (env.KONSOLE_VERSION) return true;

	// Locale UTF-8
	const locale = `${env.LANG ?? ""}${env.LC_ALL ?? ""}`.toLowerCase();
	if (locale.includes("utf")) return true;

	// win32 mặc định ASCII (tránh vỡ chữ trên cmd.exe cũ)
	if (platform === "win32") return false;

	return true;
}

// --- Tạo context chính ---

/**
 * Tạo CliDesignContext dựa trên trạng thái terminal.
 * Tất cả input có thể inject để test — không đọc process trực tiếp.
 *
 * @example
 * // Trong test
 * const ctx = createCliDesignContext({ isTTY: false, columns: 80, env: {} });
 *
 * // Trong production
 * const ctx = createCliDesignContext(); // đọc từ process tự động
 */
export function createCliDesignContext(options: CliDesignContextOptions = {}): CliDesignContext {
	const env = options.env ?? process.env;
	const isTTY = options.isTTY ?? process.stdout.isTTY === true;
	const rawWidth = options.columns ?? process.stdout.columns ?? DEFAULT_WIDTH;
	// Clamp width: tối thiểu 40 để không vỡ layout, tối đa PANEL_MAX_WIDTH
	const width = Math.max(40, Math.min(rawWidth, PANEL_MAX_WIDTH));
	const currentPlatform = options.platform ?? (process.platform as NodeJS.Platform);

	const useUnicode = supportsUnicode({ env, isTTY, platform: currentPlatform });

	return {
		box: useUnicode ? UNICODE_BOX : ASCII_BOX,
		platform: currentPlatform,
		rawWidth,
		supportsPanels: width >= PANEL_MIN_WIDTH,
		// NO_COLOR: chuẩn no-color.org chỉ cần biến TỒN TẠI (kể cả rỗng) là tắt màu
		useColor: isTTY && env.NO_COLOR === undefined,
		width,
	};
}
