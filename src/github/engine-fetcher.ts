// Tải nội dung Vit Engine (private) về máy: ưu tiên release asset, fallback tarball repo.
import { Octokit } from "@octokit/rest";
import fs from "fs-extra";
import path from "node:path";
import { CACHE_DIR, ENGINE_REPO } from "../shared/config.js";
import { log } from "../shared/logger.js";
import { extractTarball, findBundledManifest, findClaudeDir, findRootDir } from "../fetch/tarball-extractor.js";
import { streamAssetWithProgress } from "./engine-asset-streamer.js";

export interface FetchedEngine {
	engineDir: string; // đường dẫn thư mục claude/ đã giải nén
	rootDir: string | null; // thư mục root/ (payload file project-root), null nếu gói không có
	version: string; // tag release hoặc tên branch
	bundledManifestPath: string | null; // manifest đi kèm (nếu tải từ release asset)
	extractRoot: string; // thư mục tạm để dọn sau khi xong
}

/** Tùy chọn callback cho luồng tải engine */
export interface FetchEngineOptions {
	/** Gọi mỗi chunk khi stream thành công: (bytesReceived, totalBytes) */
	onDownloadProgress?: (received: number, total: number) => void;
	/** Gọi khi stream thất bại và fallback về Octokit buffer */
	onStreamFallback?: () => void;
	/** Gọi khi đã có toàn bộ buffer tải (trước khi giải nén) — caller chốt progress tải tại đây */
	onDownloadDone?: (total: number) => void;
	/** Gọi ngay trước khi bắt đầu giải nén (để caller bắt đầu spinner extract) */
	onExtractStart?: () => void;
	/** Gọi mỗi entry khi giải nén tarball: (entryCount) */
	onExtractEntry?: (count: number) => void;
}

// Kiểm tra quyền đọc repo trước (báo lỗi rõ nếu thiếu quyền/sai token).
async function assertAccess(octokit: Octokit): Promise<void> {
	try {
		await octokit.repos.get({ owner: ENGINE_REPO.owner, repo: ENGINE_REPO.repo });
	} catch (err: unknown) {
		const status = (err as { status?: number }).status;
		if (status === 404 || status === 403 || status === 401) {
			throw new Error(
				`Không có quyền đọc engine private ${ENGINE_REPO.owner}/${ENGINE_REPO.repo} (HTTP ${status}). ` +
					"Kiểm tra token còn hạn, có quyền 'repo', và bạn được mời vào repo.",
			);
		}
		throw err;
	}
}

// Thử tải release asset .tar.gz mới nhất. Trả null khi CHƯA có release (404) hoặc không có asset.
// Lỗi khác (mạng/401/403/5xx) ném ra để KHÔNG âm thầm fallback sang branch (phiên bản khác).
// Chiến lược tải: stream-first → nếu lỗi bất kỳ → fallback Octokit buffer (đường v1.4.0 nguyên vẹn).
async function tryFetchReleaseAsset(
	octokit: Octokit,
	token: string,
	options?: FetchEngineOptions,
): Promise<{ buf: Buffer; version: string } | null> {
	let rel: Awaited<ReturnType<Octokit["repos"]["getLatestRelease"]>>;
	try {
		rel = await octokit.repos.getLatestRelease({ owner: ENGINE_REPO.owner, repo: ENGINE_REPO.repo });
	} catch (err: unknown) {
		if ((err as { status?: number }).status === 404) return null; // chưa có release nào
		throw err;
	}
	const asset = rel.data.assets.find((a) => a.name.endsWith(".tar.gz"));
	if (!asset) return null;

	// Thử stream trước để hiển thị progress bar theo byte
	if (options?.onDownloadProgress) {
		try {
			const buf = await streamAssetWithProgress({
				token,
				asset: {
					id: asset.id,
					size: asset.size,
					name: asset.name,
					browser_download_url: asset.browser_download_url,
				},
				onProgress: options.onDownloadProgress,
			});
			return { buf, version: rel.data.tag_name };
		} catch (streamErr) {
			// Stream thất bại → log info + fallback về Octokit buffer (đường cũ nguyên vẹn)
			log.info(`Stream lỗi, fallback Octokit buffer: ${(streamErr as Error).message}`);
			options.onStreamFallback?.();
		}
	}

	// Đường Octokit buffer — giữ nguyên từ v1.4.0 (fallback bảo toàn auth private + redirect)
	const res = await octokit.request("GET /repos/{owner}/{repo}/releases/assets/{asset_id}", {
		owner: ENGINE_REPO.owner,
		repo: ENGINE_REPO.repo,
		asset_id: asset.id,
		headers: { accept: "application/octet-stream" },
	});
	return { buf: Buffer.from(res.data as unknown as ArrayBuffer), version: rel.data.tag_name };
}

// Fallback: tải tarball repo theo branch (luôn dùng được khi có quyền đọc).
async function fetchRepoTarball(octokit: Octokit): Promise<{ buf: Buffer; version: string }> {
	const res = await octokit.request("GET /repos/{owner}/{repo}/tarball/{ref}", {
		owner: ENGINE_REPO.owner,
		repo: ENGINE_REPO.repo,
		ref: ENGINE_REPO.branch,
	});
	return { buf: Buffer.from(res.data as unknown as ArrayBuffer), version: ENGINE_REPO.branch };
}

export async function fetchEngine(token: string, options?: FetchEngineOptions): Promise<FetchedEngine> {
	const octokit = new Octokit({ auth: token });
	await assertAccess(octokit);

	let source = await tryFetchReleaseAsset(octokit, token, options);
	if (source) {
		log.info(`Tải engine từ release ${source.version} (asset).`);
	} else {
		log.info(`Chưa có release asset — tải tarball repo theo branch '${ENGINE_REPO.branch}'.`);
		source = await fetchRepoTarball(octokit);
	}

	// Chốt chặng tải NGAY khi có buffer (trước khi giải nén) để thứ tự log đúng
	options?.onDownloadDone?.(source.buf.length);

	const extractRoot = path.join(CACHE_DIR, `engine-${Date.now()}`);
	// Báo hiệu bắt đầu giải nén để caller có thể bắt đầu spinner
	options?.onExtractStart?.();
	// Truyền onEntry xuống extract để đếm file giải nén
	await extractTarball(source.buf, extractRoot, options?.onExtractEntry);

	const engineDir = await findClaudeDir(extractRoot);
	const rootDir = await findRootDir(extractRoot);
	const bundledManifestPath = await findBundledManifest(extractRoot);

	return { engineDir, rootDir, version: source.version, bundledManifestPath, extractRoot };
}
