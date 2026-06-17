// Lệnh `vit update` — cập nhật Vit Engine lên bản mới nhất (giữ file user đã sửa).
import fs from "fs-extra";
import path from "node:path";
import { installEngine } from "../install/install-engine.js";
import { REGISTRY_FILE } from "../shared/config.js";
import { log } from "../shared/logger.js";
import { intro, outro, printPanel } from "../shared/ui/ui.js";

export interface UpdateOptions {
	token?: string;
	force?: boolean;
	dryRun?: boolean;
	installSkills?: boolean;
	yes?: boolean;
	withSudo?: boolean;
}

export async function runUpdate(options: UpdateOptions): Promise<void> {
	// intro nằm ở đây; install-engine KHÔNG gọi intro để tránh double-intro.
	intro("Vit Update");
	try {
		const hasRegistry = fs.existsSync(path.resolve(process.cwd(), REGISTRY_FILE));
		if (!hasRegistry) {
			log.warn("Chưa cài engine ở project này — chạy `vit init` trước. Vẫn tiếp tục như cài mới.");
		}

		await installEngine({
			token: options.token,
			force: options.force,
			dryRun: options.dryRun,
			installSkills: options.installSkills,
			yes: options.yes,
			withSudo: options.withSudo,
		});

		if (!options.dryRun) {
			// Panel "Bước tiếp theo" sau khi cập nhật thành công
			printPanel({
				title: "Cập nhật hoàn tất",
				zones: [
					{
						label: "Bước tiếp theo",
						lines: [
							"Engine đã được cập nhật lên bản mới nhất.",
							"Chạy `vit doctor` để xác nhận môi trường.",
						],
					},
				],
			});
			outro("Vit Engine đã cập nhật xong.");
		}
	} catch (err) {
		log.error(err instanceof Error ? err.message : String(err));
		process.exitCode = 1;
	}
}
