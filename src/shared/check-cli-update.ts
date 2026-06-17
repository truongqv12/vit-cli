// Kiểm tra có bản vit CLI mới hơn trên npm — chỉ CẢNH BÁO, không tự cài.
// Im lặng khi offline/timeout/lỗi parse: không bao giờ chặn flow init/update.
import { log } from "./logger.js";

const PKG_NAME = "@truongqv12/vit-cli";
const REGISTRY_URL = `https://registry.npmjs.org/${encodeURIComponent(PKG_NAME)}`;
const TIMEOUT_MS = 2000;

// So sánh semver dạng x.y.z bằng số (không thêm lib semver). Trả >0 nếu a > b.
function compareVersions(a: string, b: string): number {
	const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
	const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
	for (let i = 0; i < 3; i++) {
		const d = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (d !== 0) return d;
	}
	return 0;
}

export async function checkCliUpdate(currentVersion: string): Promise<void> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const res = await fetch(REGISTRY_URL, {
			signal: controller.signal,
			headers: { accept: "application/vnd.npm.install-v1+json" }, // payload gọn, chỉ dist-tags + versions
		});
		if (!res.ok) return;
		const data = (await res.json()) as { "dist-tags"?: { latest?: string } };
		const latest = data["dist-tags"]?.latest;
		// Bỏ qua nếu version có pre-release (chứa '-') để tránh so sai bằng numeric compare.
		if (!latest || latest.includes("-") || currentVersion.includes("-")) return;
		if (compareVersions(latest, currentVersion) > 0) {
			log.warn(`Có bản vit CLI mới: ${latest} (đang dùng ${currentVersion}).`);
			log.plain(`  Nâng cấp: npm i -g ${PKG_NAME}@latest`);
		}
	} catch {
		// Offline / timeout / abort / parse lỗi → im lặng, không chặn flow.
	} finally {
		clearTimeout(timer);
	}
}
