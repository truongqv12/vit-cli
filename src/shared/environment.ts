// Phát hiện môi trường chạy — quyết định có nên chạy prompt/script tương tác hay không.

export function isWindows(): boolean {
	return process.platform === "win32";
}

// CI: bỏ qua các bước tương tác để build không treo.
export function isCIEnvironment(): boolean {
	return Boolean(
		process.env.CI ||
			process.env.GITHUB_ACTIONS ||
			process.env.GITLAB_CI ||
			process.env.CONTINUOUS_INTEGRATION,
	);
}

// Không tương tác khi: CI, không có TTY, hoặc cờ NON_INTERACTIVE.
export function isNonInteractive(): boolean {
	return isCIEnvironment() || !process.stdout.isTTY || process.env.NON_INTERACTIVE === "1";
}

export function isVerbose(): boolean {
	return process.env.VIT_VERBOSE === "1";
}
