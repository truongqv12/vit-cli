// Luồng chung cho `vit init` và `vit update`:
// resolve token -> tải engine -> nạp/sinh manifest -> reconcile vào .claude/ -> dọn tạm.
import path from "node:path";
import fs from "fs-extra";
import { fetchEngine } from "../github/engine-fetcher.js";
import type { FetchEngineOptions } from "../github/engine-fetcher.js";
import { resolveToken } from "../github/token-resolver.js";
import { loadOrSynthesizeManifest } from "../reconcile/engine-manifest.js";
import { CLI_VERSION } from "../commands/version.js";
import { checkCliUpdate } from "../shared/check-cli-update.js";
import { isNonInteractive } from "../shared/environment.js";
import { log } from "../shared/logger.js";
import { scaffoldEnvFile } from "./env-scaffold.js";
import { executeInstall } from "./install-executor.js";
import { handleSkillsInstallation } from "./skills/skill-deps-installer.js";
import { promptInstallSkills } from "./skills/skills-install-prompt.js";
import { createSpinner, createProgress } from "../shared/ui/ui.js";
import type { ProgressHandle } from "../shared/ui/ui.js";

export interface InstallEngineOptions {
	token?: string;
	force?: boolean;
	dryRun?: boolean;
	// Cài deps skill ngay không hỏi (cờ --install-skills).
	installSkills?: boolean;
	// Bỏ qua mọi prompt, tự đồng ý (cờ -y/--yes) — dùng cho script/CI.
	yes?: boolean;
	withSudo?: boolean;
}

export async function installEngine(options: InstallEngineOptions): Promise<void> {
	const token = resolveToken(options.token);

	// --- UI cho chặng tải + giải nén ---
	// Spinner tải: hiện ngay, đóng khi stream bắt đầu (chuyển sang progress bar) hoặc khi xong.
	// Spinner fallback: chỉ bật khi stream lỗi và Octokit buffer được dùng.
	// Spinner giải nén: bật qua callback onExtractStart, đếm entry qua onExtractEntry.
	const downloadSpinner = createSpinner();
	const extractSpinner = createSpinner();

	// Progress bar byte tải — khởi tạo lần đầu khi nhận được chunk đầu tiên (biết total lúc đó)
	let downloadProgress: ProgressHandle | null = null;
	// Có đang dùng stream không (để chọn cách kết thúc chặng tải)
	let usingStream = false;
	// Số entry đã giải nén (để in thông tin sau)
	let extractEntryCount = 0;

	const fetchOptions: FetchEngineOptions = {
		onDownloadProgress(received: number, total: number) {
			if (!usingStream) {
				// Chunk đầu tiên → stream thành công: tắt spinner → bật progress bar
				usingStream = true;
				downloadSpinner.stop(); // tắt không có message (tiếp theo progress bar in ngay)
				downloadProgress = createProgress("Tải engine", total);
			}
			downloadProgress!.update(received);
		},
		onStreamFallback() {
			// Stream thất bại → spinner báo đang tải buffer (spinner đã chạy từ trước)
			downloadSpinner.message("Đang tải engine (buffer)…");
		},
		onDownloadDone(total: number) {
			// Chốt chặng tải TRƯỚC khi giải nén (đảm bảo thứ tự log đúng)
			if (usingStream && downloadProgress) {
				downloadProgress.done(`Đã tải engine (${total.toLocaleString()} byte)`);
			} else {
				// Đường Octokit buffer — không có progress bar, đóng spinner tải
				downloadSpinner.stop("Đã tải engine", 0);
			}
		},
		onExtractStart() {
			// Bắt đầu giải nén — bật spinner
			extractSpinner.start("Đang giải nén engine…");
		},
		onExtractEntry(count: number) {
			extractEntryCount = count;
			// Cập nhật thông điệp mỗi 50 entry để không spam stdout
			if (count % 50 === 0) {
				extractSpinner.message(`Đang giải nén… (${count} file)`);
			}
		},
	};

	// Bắt đầu spinner tải ngay (trước khi gọi fetchEngine)
	downloadSpinner.start("Đang kết nối và tải engine…");

	let fetched: Awaited<ReturnType<typeof fetchEngine>>;
	try {
		// Chặng tải được chốt trong onDownloadDone; chặng giải nén được chốt ngay sau đây.
		fetched = await fetchEngine(token, fetchOptions);
	} catch (err) {
		// Dọn tất cả spinner/progress trước khi ném lỗi lên caller (idempotent — an toàn nếu đã đóng)
		downloadSpinner.stop("Tải engine thất bại", 1);
		// Ép kiểu tường minh vì TypeScript không narrow qua closure callback
		(downloadProgress as ProgressHandle | null)?.done("Tải engine thất bại");
		extractSpinner.stop("Giải nén thất bại", 1);
		throw err;
	}

	// Kết thúc chặng giải nén
	const extractSummary =
		extractEntryCount > 0 ? `Đã giải nén ${extractEntryCount} file` : "Đã giải nén";
	extractSpinner.stop(extractSummary, 0);

	try {
		const manifest = await loadOrSynthesizeManifest(fetched.engineDir, fetched.bundledManifestPath, fetched.version);
		if (manifest.files.length === 0) {
			log.warn("Manifest rỗng — không có file engine nào để cài. Kiểm tra lại payload engine.");
			return;
		}
		log.info(`Engine ${manifest.version}: ${manifest.files.length} file payload.`);
		await executeInstall(process.cwd(), fetched.engineDir, fetched.rootDir, manifest, {
			force: options.force,
			dryRun: options.dryRun,
		});

		// Các bước hậu-cài chỉ chạy khi ghi thật (không dry-run).
		if (!options.dryRun) {
			const claudeDir = path.join(process.cwd(), ".claude");

			// 1) Scaffold .claude/.env từ .env.example nếu thiếu (không đè key user).
			await scaffoldEnvFile(claudeDir);

			// 2) Cài deps skill: mặc định HỎI khi tương tác; cờ --install-skills/-y bỏ qua hỏi.
			//    skipConfirm chỉ true khi đã quyết định cài (cờ hoặc non-interactive có cờ).
			let doInstall = Boolean(options.installSkills || options.yes);
			if (!doInstall && !isNonInteractive()) {
				doInstall = await promptInstallSkills();
			}
			if (doInstall) {
				const skillsDir = path.join(claudeDir, "skills");
				await handleSkillsInstallation(skillsDir, {
					skipConfirm: true, // đã đồng ý ở trên (cờ hoặc prompt)
					withSudo: options.withSudo,
				});
			}

			// 3) Cảnh báo nếu có bản CLI mới trên npm (im lặng nếu offline/lỗi) — đặt cuối để nằm cuối output.
			await checkCliUpdate(CLI_VERSION);
		}
	} finally {
		await fs.remove(fetched.extractRoot).catch(() => {});
	}
}
