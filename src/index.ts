// Điểm vào CLI `vit` — định tuyến lệnh bằng cac.
import { cac } from "cac";
import { runDoctor } from "./commands/doctor.js";
import { runInit } from "./commands/init.js";
import { runMigrate } from "./commands/migrate/migrate-command.js";
import { runPlan } from "./commands/plan/plan-command.js";
import { runUpdate } from "./commands/update.js";
import { CLI_VERSION, printVersion } from "./commands/version.js";
import { log } from "./shared/logger.js";

const cli = cac("vit");

cli
	.command("init", "Cài Vit Engine vào .claude/ của project hiện tại")
	.option("--token <token>", "GitHub token để truy cập engine private")
	.option("--force", "Ghi đè file user đã sửa khi trùng")
	.option("--install-skills", "Cài deps skill ngay không hỏi (python venv, npm)")
	.option("-y, --yes", "Tự đồng ý mọi prompt (cài deps skill) — dùng cho script/CI")
	.option("--with-sudo", "Linux: gồm gói hệ thống cần sudo (ffmpeg, imagemagick)")
	.action((options) => runInit(options));

cli
	.command("update", "Cập nhật Vit Engine lên bản mới nhất")
	.option("--token <token>", "GitHub token để truy cập engine private")
	.option("--force", "Ghi đè file user đã sửa khi trùng")
	.option("--dry-run", "Chỉ xem thay đổi, không ghi")
	.option("--install-skills", "Cài deps skill ngay không hỏi (python venv, npm)")
	.option("-y, --yes", "Tự đồng ý mọi prompt (cài deps skill) — dùng cho script/CI")
	.option("--with-sudo", "Linux: gồm gói hệ thống cần sudo (ffmpeg, imagemagick)")
	.action((options) => runUpdate(options));

cli
	.command("plan [action] [target]", "Quản lý plan: create | check | uncheck | status")
	.option("--title <title>", "Tiêu đề plan (create)")
	.option("--phases <phases>", "Danh sách phase ngăn cách dấu phẩy (create)")
	.option("--dir <slug>", "Slug thư mục plan (create)")
	.option("--start", "Đánh dấu phase đang làm thay vì xong (check)")
	.action((action, target, options) => runPlan(action, target, options));

cli
	.command("migrate", "Xuất .claude/ sang provider AI khác (codex, opencode, antigravity)")
	// Chọn provider
	.option("-a, --agent <agents...>", "Provider đích (codex, opencode, antigravity) — lặp được")
	.option("--all", "Migrate sang cả 3 provider")
	.option("--providers <list>", "(alias của --agent) danh sách provider ngăn cách dấu phẩy")
	// Scope / ghi đè
	.option("-g, --global", "Migrate từ ~/.claude/ thay vì .claude/ project")
	.option("-f, --force", "Cài lại cả khi nội dung không đổi (đè + backup)")
	.option("-y, --yes", "Bỏ qua prompt xác nhận")
	.option("--dry-run", "Xem kế hoạch, không ghi file")
	// Chỉ migrate loại được bật
	.option("--only-agents", "Chỉ migrate agents")
	.option("--only-commands", "Chỉ migrate commands")
	.option("--only-skills", "Chỉ migrate skills")
	.option("--config", "Chỉ migrate CLAUDE.md config")
	.option("--rules", "Chỉ migrate .claude/rules/")
	.option("--hooks", "Chỉ migrate .claude/hooks/")
	// Loại bỏ loại
	.option("--skip-agents", "Bỏ qua agents")
	.option("--skip-commands", "Bỏ qua commands")
	.option("--skip-skills", "Bỏ qua skills")
	.option("--skip-config", "Bỏ qua config")
	.option("--skip-rules", "Bỏ qua rules")
	.option("--skip-hooks", "Bỏ qua hooks")
	// Nguồn config tùy biến
	.option("--source <path>", "Đường dẫn CLAUDE.md tùy biến (chỉ áp cho config)")
	// Mode flags (parity bề mặt)
	.option("--install", "Chọn item để cài (vit ánh xạ về install loop)")
	.option("--reconcile", "Ép đối chiếu (vit dùng idempotent checksum, chưa phát hiện user-edit nâng cao)")
	.option("--reinstall-empty-dirs", "Cài lại item khi thư mục loại rỗng (mặc định)")
	.option("--respect-deletions", "Giữ trạng thái đã xóa (vô hiệu reinstall-empty-dirs)")
	.action((options) => {
		// cac trả --agent dạng scalar khi chỉ 1 giá trị; chuẩn hoá về mảng cho resolveProviders
		if (options.agent !== undefined && !Array.isArray(options.agent)) {
			options.agent = [options.agent];
		}
		// cac KHÔNG gom giá trị cách bằng dấu cách vào --agent; phần dư rơi vào cli.args và bị bỏ.
		// Cảnh báo để tránh âm thầm bỏ provider — phải lặp cờ (-a x -a y) hoặc CSV (-a x,y).
		if (cli.args.length > 0) {
			log.warn(
				`Bỏ qua tham số dư: ${cli.args.join(", ")}. ` +
				`Chọn nhiều provider bằng cách lặp cờ "-a codex -a opencode" hoặc CSV "-a codex,opencode".`,
			);
		}
		return runMigrate(options);
	});

cli.command("doctor", "Kiểm tra môi trường (gh token, quyền engine, .claude/)").action(() => runDoctor());

cli.command("version", "In phiên bản CLI và engine đã cài").action(() => printVersion());

cli.help();
cli.version(CLI_VERSION);

try {
	cli.parse();
	if (!cli.matchedCommand && process.argv.slice(2).length === 0) {
		cli.outputHelp();
	}
} catch (err) {
	log.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
}
