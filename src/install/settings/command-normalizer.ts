// Chuẩn hoá lệnh hook để so sánh/dedup nhất quán.
// vit per-project dùng path tương đối .claude/... nên chỉ cần bỏ quote + chuẩn slash.

export function normalizeCommand(cmd?: string | null): string {
	if (!cmd) return "";
	return cmd
		.replace(/"/g, "") // quote chỉ có nghĩa khi chạy shell, không cần khi so sánh
		.replace(/\\/g, "/") // chuẩn slash (Windows \\ -> /)
		.trim();
}
