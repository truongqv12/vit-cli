// Resolve GitHub token để truy cập engine private.
// Thứ tự ưu tiên: cờ --token  ->  GITHUB_TOKEN / GH_TOKEN  ->  `gh auth token`.
import { execFileSync } from "node:child_process";

export function resolveToken(explicit?: string): string {
	if (explicit) return explicit;
	if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
	if (process.env.GH_TOKEN) return process.env.GH_TOKEN;

	try {
		const token = execFileSync("gh", ["auth", "token"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		if (token) return token;
	} catch {
		// gh chưa cài hoặc chưa đăng nhập
	}

	throw new Error(
		"Không tìm thấy GitHub token. Chạy `gh auth login`, hoặc đặt GITHUB_TOKEN, hoặc truyền --token <token>.",
	);
}
