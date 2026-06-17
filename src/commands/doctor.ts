// Lệnh `vit doctor` — kiểm tra môi trường trước khi cài/cập nhật.
import { execFileSync } from "node:child_process";
import fs from "fs-extra";
import path from "node:path";
import { REGISTRY_FILE, RUNTIME_DIR } from "../shared/config.js";
import { log } from "../shared/logger.js";

function checkGhToken(): boolean {
	if (process.env.GITHUB_TOKEN) {
		log.ok("GITHUB_TOKEN có trong môi trường.");
		return true;
	}
	try {
		const token = execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
		if (token) {
			log.ok("Đã lấy được token qua `gh auth token`.");
			return true;
		}
	} catch {
		// gh chưa cài hoặc chưa đăng nhập
	}
	log.warn("Không có token. Chạy `gh auth login` hoặc đặt GITHUB_TOKEN để truy cập engine private.");
	return false;
}

export function runDoctor(): void {
	log.plain("Vit doctor — kiểm tra môi trường:\n");

	const nodeMajor = Number(process.versions.node.split(".")[0]);
	if (nodeMajor >= 18) log.ok(`Node ${process.versions.node}`);
	else log.error(`Node ${process.versions.node} — cần >= 18.`);

	checkGhToken();

	const runtimePath = path.resolve(process.cwd(), RUNTIME_DIR);
	if (fs.existsSync(runtimePath)) {
		log.ok(`Đã có ${RUNTIME_DIR}/ trong project.`);
		const registryPath = path.resolve(process.cwd(), REGISTRY_FILE);
		if (fs.existsSync(registryPath)) log.ok("Có registry engine (đã cài bằng vit).");
		else log.info(`${RUNTIME_DIR}/ tồn tại nhưng chưa có registry vit — có thể cài đè bằng \`vit init\`.`);
	} else {
		log.info(`Chưa có ${RUNTIME_DIR}/ — chạy \`vit init\` để cài engine.`);
	}
}
