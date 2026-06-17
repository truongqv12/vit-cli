/**
 * Mode validator — kiểm tra mutual-exclusion cho các cờ mode của migrate.
 * Port rút gọn từ ck (KISS): vit ánh xạ mode về install loop idempotent + force, chưa có reconciler
 * thuần phát hiện user-edit. Validator chỉ chặn cặp cờ mâu thuẫn để parity hành vi CLI.
 */
import type { MigrateOptions } from "./migrate-types.js";

/**
 * Trả về thông báo lỗi nếu cờ mode mâu thuẫn, ngược lại null.
 *   - --install và --reconcile loại trừ nhau.
 *   - --reinstall-empty-dirs và --respect-deletions loại trừ nhau.
 */
export function validateMutualExclusion(options: MigrateOptions): string | null {
	if (options.install === true && options.reconcile === true) {
		return "Chỉ truyền một trong --install hoặc --reconcile, không dùng cả hai.";
	}
	if (options.reinstallEmptyDirs === true && options.respectDeletions === true) {
		return "Chỉ truyền một trong --reinstall-empty-dirs hoặc --respect-deletions, không dùng cả hai.";
	}
	return null;
}
