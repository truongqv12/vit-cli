// Chống path traversal: chỉ cho phép path con nằm trong thư mục gốc.
import path from "node:path";

// Resolve `rel` so với `root`; ném lỗi nếu kết quả thoát ra ngoài `root`.
export function safeResolve(root: string, rel: string): string {
	const rootResolved = path.resolve(root);
	const target = path.resolve(rootResolved, rel);
	if (target !== rootResolved && !target.startsWith(rootResolved + path.sep)) {
		throw new Error(`Đường dẫn không an toàn (thoát khỏi ${rootResolved}): ${rel}`);
	}
	return target;
}

// True nếu một thành phần path là ".." (dùng lọc entry khi giải nén tar).
export function hasDotDotSegment(p: string): boolean {
	return p.split(/[\\/]/).includes("..");
}
