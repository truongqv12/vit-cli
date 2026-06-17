// Điểm vào CLI `vit` — định tuyến lệnh bằng cac.
import { cac } from "cac";
import { runDoctor } from "./commands/doctor.js";
import { runInit } from "./commands/init.js";
import { runPlan } from "./commands/plan/plan-command.js";
import { runUpdate } from "./commands/update.js";
import { printVersion } from "./commands/version.js";
import { log } from "./shared/logger.js";

const cli = cac("vit");

cli
	.command("init", "Cài Vit Engine vào .claude/ của project hiện tại")
	.option("--token <token>", "GitHub token để truy cập engine private")
	.option("--force", "Ghi đè file user đã sửa khi trùng")
	.action((options) => runInit(options));

cli
	.command("update", "Cập nhật Vit Engine lên bản mới nhất")
	.option("--token <token>", "GitHub token để truy cập engine private")
	.option("--force", "Ghi đè file user đã sửa khi trùng")
	.option("--dry-run", "Chỉ xem thay đổi, không ghi")
	.action((options) => runUpdate(options));

cli
	.command("plan [action] [target]", "Quản lý plan: create | check | uncheck | status")
	.option("--title <title>", "Tiêu đề plan (create)")
	.option("--phases <phases>", "Danh sách phase ngăn cách dấu phẩy (create)")
	.option("--dir <slug>", "Slug thư mục plan (create)")
	.option("--start", "Đánh dấu phase đang làm thay vì xong (check)")
	.action((action, target, options) => runPlan(action, target, options));

cli.command("doctor", "Kiểm tra môi trường (gh token, quyền engine, .claude/)").action(() => runDoctor());

cli.command("version", "In phiên bản CLI và engine đã cài").action(() => printVersion());

cli.help();
cli.version("0.1.0");

try {
	cli.parse();
	if (!cli.matchedCommand && process.argv.slice(2).length === 0) {
		cli.outputHelp();
	}
} catch (err) {
	log.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
}
