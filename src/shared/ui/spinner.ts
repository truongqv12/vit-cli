// Bọc @clack/prompts spinner với gate TTY tự động.
// TTY: dùng clack animation đầy đủ.
// Non-TTY: fallback in dòng tĩnh qua logger (không gọi clack để tránh escape code rác).

import * as clack from "@clack/prompts";
import { log } from "../logger.js";
import { createCliDesignContext } from "./ui-capabilities.js";

// --- Interface công khai ---

/** Interface spinner thống nhất cho cả TTY và non-TTY */
export interface SpinnerHandle {
	/** Bắt đầu spinner với thông điệp khởi đầu */
	start(message: string): void;
	/** Cập nhật thông điệp đang hiển thị (no-op trên non-TTY) */
	message(message: string): void;
	/**
	 * Dừng spinner.
	 * @param message  Thông điệp kết quả (mặc định giữ nguyên message hiện tại)
	 * @param code     0 = thành công (✓), 1 = lỗi (✗), undefined = trung lập
	 */
	stop(message?: string, code?: number): void;
}

// --- Factory ---

/**
 * Tạo spinner phù hợp với môi trường hiện tại.
 * Inject options để test có thể giả lập TTY/non-TTY mà không cần mock process.
 *
 * @param options  Tùy chọn inject env/isTTY/columns (dùng trong test)
 *
 * @example
 * const spin = createSpinner();
 * spin.start("Đang tải dữ liệu...");
 * await fetchData();
 * spin.stop("Hoàn thành", 0);
 */
export function createSpinner(options?: {
	env?: NodeJS.ProcessEnv;
	isTTY?: boolean;
	columns?: number;
}): SpinnerHandle {
	const ctx = createCliDesignContext({
		env: options?.env,
		isTTY: options?.isTTY,
		columns: options?.columns,
	});

	// Gate TTY: chỉ dùng clack khi có TTY và màu được bật
	// ctx.useColor = isTTY && !NO_COLOR — dùng làm proxy cho "terminal tương tác"
	const isTTY = options?.isTTY ?? process.stdout.isTTY === true;

	if (isTTY) {
		return createTtySpinner();
	}
	return createPlainSpinner();
}

// --- Spinner TTY (dùng @clack/prompts) ---

function createTtySpinner(): SpinnerHandle {
	// clack.spinner() trả object với start/stop/message
	const clackSpinner = clack.spinner();
	let started = false;

	return {
		start(message: string): void {
			started = true;
			clackSpinner.start(message);
		},

		message(message: string): void {
			if (started) {
				clackSpinner.message(message);
			}
		},

		stop(message?: string, code?: number): void {
			if (!started) return;
			started = false;
			// code: 0 = thành công, 1 = lỗi, undefined/khác = trung lập
			clackSpinner.stop(message, code);
		},
	};
}

// --- Spinner plain (non-TTY / CI) ---

/**
 * Fallback khi không có TTY: in dòng tĩnh thay vì animation.
 * start() in [i] message, stop() in [OK] hoặc [X] tùy code.
 * message() là no-op để tránh spam stdout trong CI.
 */
function createPlainSpinner(): SpinnerHandle {
	return {
		start(message: string): void {
			log.info(message);
		},

		// No-op trong non-TTY — tránh lộn xộn output CI
		message(_message: string): void {
			// Cố tình để trống: non-TTY không cần cập nhật real-time
		},

		stop(message?: string, code?: number): void {
			// Không message tường minh → dừng im lặng (vd bàn giao sang progress bar), tránh in lại dòng cũ
			if (message === undefined) return;
			if (code === 1) {
				log.error(message);
			} else {
				log.ok(message);
			}
		},
	};
}
