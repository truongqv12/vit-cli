// Progress bar: hàm render THUẦN + wrapper quản lý I/O có throttle.
// renderProgressBar() không có side effect — an toàn dùng trong test.
// createProgress() chỉ ghi stdout khi TTY; non-TTY in mốc thưa xuống dòng.

import { createCliDesignContext } from "./ui-capabilities.js";
import { visibleWidth } from "./panel-tokens.js";

// --- Render thuần (không I/O) ---

/**
 * Render chuỗi progress bar dạng `[████░░░░] 42% (650/1537)`.
 * Không phụ thuộc TTY — chỉ tính toán và trả string.
 *
 * @param current  Giá trị hiện tại (>= 0)
 * @param total    Tổng giá trị. total=0 → trả chuỗi rỗng (không thể tính %)
 * @param width    Số ký tự bên trong ngoặc vuông [..] (mặc định 24)
 * @param useUnicode  Dùng ký tự block Unicode hay ASCII (#/.)
 * @returns Chuỗi progress bar đã định dạng
 *
 * @example
 * renderProgressBar(650, 1537)
 * // "[████████░░░░░░░░░░░░░░░░] 42% (650/1537)"  (unicode)
 * // "[##########..............] 42% (650/1537)"  (ascii)
 */
export function renderProgressBar(
	current: number,
	total: number,
	width = 24,
	useUnicode = true,
): string {
	// Phòng thủ: total=0 hoặc âm → không thể tính phần trăm
	if (total <= 0) return "";

	// Clamp current về [0, total]
	const safeValue = Math.max(0, Math.min(current, total));
	const pct = safeValue / total;
	const pctDisplay = Math.floor(pct * 100);

	// Số ký tự đã fill — dùng floor (đồng bộ với pctDisplay) để bar không đầy trước 100%
	const filled = Math.floor(pct * width);
	const empty = width - filled;

	const fillChar = useUnicode ? "█" : "#";
	const emptyChar = useUnicode ? "░" : ".";

	const bar = `[${fillChar.repeat(filled)}${emptyChar.repeat(empty)}]`;
	return `${bar} ${pctDisplay}% (${safeValue}/${total})`;
}

// --- Wrapper I/O có throttle ---

export interface ProgressHandle {
	/** Cập nhật giá trị hiện tại; có throttle để tránh spam stdout */
	update(current: number): void;
	/** Kết thúc progress: in dòng hoàn thành và xuống dòng */
	done(message?: string): void;
}

/**
 * Tạo progress tracker cho một tác vụ.
 * TTY: ghi đè dòng hiện tại bằng `\r` mỗi ~16ms hoặc khi tăng ≥ 1%.
 * Non-TTY: chỉ in mốc 0/25/50/75/100% mỗi mốc một dòng riêng.
 *
 * @param label    Nhãn hiển thị trước thanh progress
 * @param total    Tổng giá trị (phải > 0)
 * @param options  Tùy chọn: env/isTTY/columns để test inject
 */
export function createProgress(
	label: string,
	total: number,
	options?: { env?: NodeJS.ProcessEnv; isTTY?: boolean; columns?: number },
): ProgressHandle {
	const ctx = createCliDesignContext({
		env: options?.env,
		isTTY: options?.isTTY,
		columns: options?.columns,
	});

	const useUnicode = ctx.box.h !== "-"; // ASCII_BOX.h === "-"
	const isTTY = ctx.useColor || (options?.isTTY ?? process.stdout.isTTY === true);

	// Trạng thái nội bộ
	let lastPct = -1; // % đã in lần trước (để kiểm tra mốc non-TTY)
	let lastRenderMs = 0; // timestamp lần render TTY gần nhất
	let isDone = false;

	// Các mốc % sẽ in khi non-TTY
	const NON_TTY_MILESTONES = [0, 25, 50, 75, 100];
	const printedMilestones = new Set<number>();

	/**
	 * Tính và ghi progress hiện tại ra stdout.
	 * TTY: ghi đè dòng bằng \r.
	 * Non-TTY: chỉ in các mốc đặc biệt.
	 */
	function render(current: number, force = false): void {
		if (isDone || total <= 0) return;

		const safeValue = Math.max(0, Math.min(current, total));
		const pct = Math.floor((safeValue / total) * 100);
		const nowMs = Date.now();

		if (isTTY) {
			// Throttle: chỉ render nếu đủ 16ms HOẶC tăng >= 1%
			const percentChanged = pct !== lastPct;
			const timeElapsed = nowMs - lastRenderMs >= 16;
			if (!force && !percentChanged && !timeElapsed) return;

			const bar = renderProgressBar(safeValue, total, 24, useUnicode);
			const line = `${label} ${bar}`;
			// \r về đầu dòng, ghi đè nội dung cũ
			process.stdout.write(`\r${line}`);
			lastPct = pct;
			lastRenderMs = nowMs;
		} else {
			// Non-TTY: chỉ in mốc 0/25/50/75/100
			for (const milestone of NON_TTY_MILESTONES) {
				if (!printedMilestones.has(milestone) && pct >= milestone) {
					const bar = renderProgressBar(safeValue, total, 24, false); // ASCII cho non-TTY
					process.stdout.write(`${label} ${bar}\n`);
					printedMilestones.add(milestone);
				}
			}
			lastPct = pct;
		}
	}

	// In mốc 0% ngay khi tạo (non-TTY)
	if (!isTTY && total > 0) {
		render(0, true);
	}

	return {
		update(current: number): void {
			render(current);
		},

		done(message?: string): void {
			if (isDone) return;
			isDone = true;

			if (isTTY) {
				// Hoàn thành: render 100% rồi xuống dòng
				const bar = renderProgressBar(total, total, 24, useUnicode);
				const line = message ?? `${label} ${bar}`;
				process.stdout.write(`\r${line}\n`);
			} else {
				// Non-TTY: đảm bảo mốc 100 được in
				if (!printedMilestones.has(100)) {
					const bar = renderProgressBar(total, total, 24, false);
					process.stdout.write(`${label} ${bar}\n`);
				}
				if (message) {
					process.stdout.write(`${message}\n`);
				}
			}
		},
	};
}
