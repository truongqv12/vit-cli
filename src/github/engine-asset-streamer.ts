// Tải release asset theo byte bằng fetch stream để hiển thị progress.
// Chiến lược: resolve redirect 2 bước để KHÔNG gửi token sang S3.
//   Bước 1: gọi GitHub API endpoint với token + redirect:"manual" → lấy header Location.
//   Bước 2: fetch(location) KHÔNG token (S3 từ chối Authorization header).
// Khi bất kỳ bước nào lỗi → ném lỗi → caller dùng fallback Octokit buffer.

import { ENGINE_REPO } from "../shared/config.js";

// Thông tin asset GitHub release
export interface GitHubAsset {
	id: number;
	size: number;
	name: string;
	// URL công khai (redirect về S3); dùng khi resolve API endpoint thất bại
	browser_download_url: string;
}

export interface StreamAssetOptions {
	token: string;
	asset: GitHubAsset;
	/** Callback cập nhật tiến độ: (bytesReceived, totalBytes) */
	onProgress: (received: number, total: number) => void;
}

/**
 * Tải release asset GitHub qua stream fetch, gọi onProgress mỗi chunk.
 * Trả Buffer đầy đủ sau khi xong, verify kích thước so với asset.size.
 * Ném lỗi khi: mạng lỗi, redirect thất bại, kích thước lệch → caller dùng fallback.
 */
export async function streamAssetWithProgress(options: StreamAssetOptions): Promise<Buffer> {
	const { token, asset, onProgress } = options;

	// Resolve URL thực để tải (không gửi token sang S3)
	const downloadUrl = await resolveDownloadUrl(token, asset);

	// Tải theo stream — không kèm token (URL đã chứa query auth của S3)
	const res = await fetch(downloadUrl);
	if (!res.ok) {
		throw new Error(`Tải asset thất bại: HTTP ${res.status} từ ${downloadUrl}`);
	}
	if (!res.body) {
		throw new Error("Response không có body stream — không thể đọc theo chunk");
	}

	const total = asset.size;
	const chunks: Buffer[] = [];
	let received = 0;

	// Đọc từng chunk, cộng dồn và thông báo tiến độ
	const reader = res.body.getReader();
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			const chunk = Buffer.from(value);
			chunks.push(chunk);
			received += chunk.length;
			onProgress(received, total);
		}
	} finally {
		reader.releaseLock();
	}

	const buf = Buffer.concat(chunks);

	// Bảo vệ toàn vẹn: kích thước lệch → ném lỗi → caller fallback buffer
	if (buf.length !== total) {
		throw new Error(
			`Kích thước tải lệch: nhận ${buf.length} byte, mong đợi ${total} byte. ` +
				"Bỏ qua để ngăn cài file hỏng.",
		);
	}

	return buf;
}

/**
 * Resolve URL download thực cho asset private GitHub.
 * Thử tự resolve redirect từ GitHub API (chuẩn private asset).
 * Thất bại → dùng browser_download_url làm fallback.
 * Token KHÔNG gửi trong URL download cuối.
 */
async function resolveDownloadUrl(token: string, asset: GitHubAsset): Promise<string> {
	// Endpoint API asset của GitHub — trả redirect 302 về S3 khi dùng Authorization
	const apiUrl =
		`https://api.github.com/repos/${ENGINE_REPO.owner}/${ENGINE_REPO.repo}` +
		`/releases/assets/${asset.id}`;

	try {
		// redirect:"manual" để lấy Location mà không follow (tránh gửi token sang S3)
		const apiRes = await fetch(apiUrl, {
			method: "GET",
			redirect: "manual",
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/octet-stream",
				"User-Agent": "vit-cli",
			},
		});

		// 302/301/307/308 → đọc Location header là URL S3 (không cần token)
		if (apiRes.status >= 300 && apiRes.status < 400) {
			const location = apiRes.headers.get("location");
			if (location) return location;
		}

		// 200 trực tiếp (ít gặp): body là asset, nhưng không có stream thêm ở đây
		// → fallback về browser_download_url để dùng luồng stream bình thường
	} catch {
		// Mạng lỗi ở bước resolve → thử browser_download_url
	}

	// Fallback: browser_download_url (asset public / redirect mà không cần token)
	return asset.browser_download_url;
}
