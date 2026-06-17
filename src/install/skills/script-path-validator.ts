// Validate đường dẫn script trước khi chạy — chống path traversal + shell injection.
import { resolve, sep } from "node:path";
import { isWindows } from "../../shared/environment.js";

export function validateScriptPath(skillsDir: string, scriptPath: string): void {
	const skillsDirResolved = resolve(skillsDir);
	const scriptPathResolved = resolve(scriptPath);

	// Phải nằm trong thư mục skills (Windows so sánh không phân biệt hoa thường).
	const dirNorm = isWindows() ? skillsDirResolved.toLowerCase() : skillsDirResolved;
	const scriptNorm = isWindows() ? scriptPathResolved.toLowerCase() : scriptPathResolved;

	// So sánh theo ranh giới thư mục (dirNorm + sep) để tránh prefix-collision
	// kiểu "skills" khớp nhầm "skills-evil".
	if (scriptNorm !== dirNorm && !scriptNorm.startsWith(dirNorm + sep)) {
		throw new Error(`Đường dẫn script nằm ngoài thư mục skills: ${scriptPath}`);
	}

	// Không cho ký tự có thể phá shell.
	const dangerous = ['"', "'", "`", "$", ";", "&", "|", "\n", "\r", "\0"];
	for (const ch of dangerous) {
		if (scriptPath.includes(ch)) {
			throw new Error(`Đường dẫn script chứa ký tự không an toàn: ${ch}`);
		}
	}
}
