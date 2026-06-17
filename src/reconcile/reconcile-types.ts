// Kiểu dữ liệu dùng chung cho quá trình reconcile (thuần, không I/O).

export interface ManifestFile {
	path: string; // tương đối so với runtime root (.claude/)
	checksum: string; // sha256 nội dung file nguồn
	size?: number;
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
}

export interface ReconcilePlan {
	actions: ReconcileAction[];
}

// Trạng thái đích cho 1 path: checksum file hiện có (null nếu chưa tồn tại).
export type TargetState = Record<string, string | null>;
