// Kiểu dữ liệu dùng chung cho quá trình reconcile (thuần, không I/O).

// Vùng đích của file: "claude" -> cài vào .claude/ ; "root" -> cài vào project root.
export type FileArea = "claude" | "root";

export interface ManifestFile {
	path: string; // tương đối so với vùng đích (.claude/ với claude, project root với root)
	checksum: string; // sha256 nội dung file nguồn
	size?: number;
	area?: FileArea; // mặc định coi như "claude" (tương thích manifest cũ)
}

// Khoá định danh nội bộ (registry/targetState). Giữ path trần cho vùng claude để
// tương thích ngược registry đã cài; vùng root thêm prefix "root:" tách namespace.
// Nhờ vậy file trùng tên giữa 2 vùng (vd ".gitignore") không đụng nhau.
export function manifestKey(area: FileArea | undefined, p: string): string {
	return area === "root" ? `root:${p}` : p;
}

export interface EngineManifest {
	version: string;
	files: ManifestFile[];
}

// Một mục trong registry: lưu cả checksum nguồn lẫn checksum đích lần cài trước,
// để phát hiện user có sửa tay file đã cài hay không.
export interface RegistryEntry {
	sourceChecksum: string;
	targetChecksum: string;
}

export interface Registry {
	engineVersion: string;
	files: Record<string, RegistryEntry>; // key = path tương đối
}

export type ActionType = "install" | "update" | "skip" | "conflict" | "delete";

export interface ReconcileAction {
	type: ActionType;
	path: string;
	reason: string;
	area?: FileArea; // vùng đích để executor resolve base; mặc định "claude"
}

export interface ReconcilePlan {
	actions: ReconcileAction[];
}

// Trạng thái đích cho 1 path: checksum file hiện có (null nếu chưa tồn tại).
export type TargetState = Record<string, string | null>;
