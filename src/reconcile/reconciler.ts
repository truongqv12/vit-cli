// Reconciler THUẦN — không I/O. Nhận manifest + registry + trạng thái đích hiện tại,
// trả về plan hành động cho từng file. Mọi đọc/ghi file nằm ở executor.
import type { EngineManifest, ReconcileAction, ReconcilePlan, Registry, TargetState } from "./reconcile-types.js";

export interface ReconcileInput {
	manifest: EngineManifest;
	registry: Registry | null; // null nếu cài lần đầu (init)
	targetState: TargetState; // checksum file đích hiện tại cho từng path trong manifest
	deletions: string[]; // metadata.deletions[] từ engine
	force: boolean; // ghi đè cả khi conflict
}

export function reconcile(input: ReconcileInput): ReconcilePlan {
	const { manifest, registry, targetState, deletions, force } = input;
	const actions: ReconcileAction[] = [];
	const regFiles = registry?.files ?? {};

	for (const file of manifest.files) {
		const src = file.checksum;
		const cur = targetState[file.path] ?? null;
		const reg = regFiles[file.path];

		// File đích chưa tồn tại -> cài mới.
		if (cur === null) {
			actions.push({ type: "install", path: file.path, reason: "file chưa tồn tại" });
			continue;
		}

		// Đã trùng hệt nguồn -> bỏ qua.
		if (cur === src) {
			actions.push({ type: "skip", path: file.path, reason: "đã trùng nguồn" });
			continue;
		}

		if (reg) {
			const userModified = cur !== reg.targetChecksum;
			const engineChanged = src !== reg.sourceChecksum;

			if (!userModified && engineChanged) {
				actions.push({ type: "update", path: file.path, reason: "engine đổi, user chưa sửa" });
			} else if (userModified && !engineChanged) {
				actions.push(
					force
						? { type: "update", path: file.path, reason: "khôi phục bản engine do --force" }
						: { type: "skip", path: file.path, reason: "giữ bản user sửa (engine không đổi)" },
				);
			} else if (userModified && engineChanged) {
				actions.push(
					force
						? { type: "update", path: file.path, reason: "conflict — ghi đè do --force" }
						: { type: "conflict", path: file.path, reason: "cả engine lẫn user đều đổi" },
				);
			} else {
				// !userModified && !engineChanged nhưng cur != src: hiếm, coi như cập nhật.
				actions.push({ type: "update", path: file.path, reason: "lệch checksum, đồng bộ lại" });
			}
			continue;
		}

		// Không có registry (file đích có sẵn, không do vit quản) và khác nguồn.
		actions.push(
			force
				? { type: "update", path: file.path, reason: "file có sẵn — ghi đè do --force" }
				: { type: "conflict", path: file.path, reason: "file có sẵn không do vit quản, khác nguồn" },
		);
	}

	// Deletions: chỉ xoá file vit từng cài và user chưa sửa.
	const manifestPaths = new Set(manifest.files.map((f) => f.path));
	for (const del of deletions) {
		if (manifestPaths.has(del)) continue; // còn trong manifest thì không xoá
		const cur = targetState[del] ?? null;
		if (cur === null) continue; // không tồn tại, khỏi xoá
		const reg = regFiles[del];
		if (reg && cur === reg.targetChecksum) {
			actions.push({ type: "delete", path: del, reason: "file cũ trong deletions[], user chưa sửa" });
		} else {
			actions.push({ type: "skip", path: del, reason: "deletions[] nhưng user đã sửa — giữ lại" });
		}
	}

	return { actions };
}
