// Tải nội dung Vit Engine (private) về máy: ưu tiên release asset, fallback tarball repo.
import { Octokit } from "@octokit/rest";
import fs from "fs-extra";
import path from "node:path";
import { CACHE_DIR, ENGINE_REPO } from "../shared/config.js";
import { log } from "../shared/logger.js";
import { extractTarball, findBundledManifest, findClaudeDir, findRootDir } from "../fetch/tarball-extractor.js";

export interface FetchedEngine {
	engineDir: string; // đường dẫn thư mục claude/ đã giải nén
	rootDir: string | null; // thư mục root/ (payload file project-root), null nếu gói không có
	version: string; // tag release hoặc tên branch
	bundledManifestPath: string | null; // manifest đi kèm (nếu tải từ release asset)
	extractRoot: string; // thư mục tạm để dọn sau khi xong
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
async function tryFetchReleaseAsset(octokit: Octokit): Promise<{ buf: Buffer; version: string } | null> {
	let rel: Awaited<ReturnType<Octokit["repos"]["getLatestRelease"]>>;
	try {
		rel = await octokit.repos.getLatestRelease({ owner: ENGINE_REPO.owner, repo: ENGINE_REPO.repo });
	} catch (err: unknown) {
		if ((err as { status?: number }).status === 404) return null; // chưa có release nào
		throw err;
	}
	const asset = rel.data.assets.find((a) => a.name.endsWith(".tar.gz"));
	if (!asset) return null;
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

export async function fetchEngine(token: string): Promise<FetchedEngine> {
	const octokit = new Octokit({ auth: token });
	await assertAccess(octokit);

	let source = await tryFetchReleaseAsset(octokit);
	if (source) {
		log.info(`Tải engine từ release ${source.version} (asset).`);
	} else {
		log.info(`Chưa có release asset — tải tarball repo theo branch '${ENGINE_REPO.branch}'.`);
		source = await fetchRepoTarball(octokit);
	}

	const extractRoot = path.join(CACHE_DIR, `engine-${Date.now()}`);
	await extractTarball(source.buf, extractRoot);

	const engineDir = await findClaudeDir(extractRoot);
	const rootDir = await findRootDir(extractRoot);
	const bundledManifestPath = await findBundledManifest(extractRoot);

	return { engineDir, rootDir, version: source.version, bundledManifestPath, extractRoot };
}
