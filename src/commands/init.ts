// Lệnh `vit init` — cài Vit Engine vào .claude/ của project hiện tại.
import { installEngine } from "../install/install-engine.js";
import { log } from "../shared/logger.js";
import { intro, outro, printPanel } from "../shared/ui/ui.js";

export interface InitOptions {
	token?: string;
	force?: boolean;
	installSkills?: boolean;
	yes?: boolean;
	withSudo?: boolean;
}

export async function runInit(options: InitOptions): Promise<void> {
	// intro nằm ở đây; install-engine KHÔNG gọi intro để tránh double-intro.
	intro("Vit Init");
	try {
		await installEngine({
			token: options.token,
			force: options.force,
			installSkills: options.installSkills,
			yes: options.yes,
			withSudo: options.withSudo,
		});

		// Panel "Bước tiếp theo" sau khi cài thành công
		printPanel({
			title: "Cài đặt hoàn tất",
			zones: [
				{
					label: "Bước tiếp theo",
					lines: [
						"Mở Claude Code và dùng các lệnh sau:",
						"  /vit:plan   — lập kế hoạch triển khai",
						"  /vit:cook   — thực thi kế hoạch",
						"  /vit:scout  — khám phá codebase",
						"  /vit:fix    — sửa lỗi tự động",
					],
				},
			],
		});
		outro("Vit Engine đã sẵn sàng.");
	} catch (err) {
		log.error(err instanceof Error ? err.message : String(err));
		process.exitCode = 1;
	}
}
