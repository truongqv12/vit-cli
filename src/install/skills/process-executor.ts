// Chạy script cài deps skill với output stream thời gian thực.
// stdio inherit để user (đặc biệt Windows) thấy tiến trình PowerShell ngay.
import { spawn } from "node:child_process";

export function executeInteractiveScript(
	command: string,
	args: string[],
	options?: { timeout?: number; cwd?: string; env?: NodeJS.ProcessEnv },
): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: ["ignore", "inherit", "inherit"],
			cwd: options?.cwd,
			env: options?.env || process.env,
		});

		let timeoutId: NodeJS.Timeout | undefined;
		if (options?.timeout) {
			timeoutId = setTimeout(() => {
				child.kill("SIGTERM");
				reject(new Error(`Script vượt quá ${options.timeout}ms — đã huỷ`));
			}, options.timeout);
		}

		child.on("exit", (code, signal) => {
			if (timeoutId) clearTimeout(timeoutId);
			if (signal) {
				reject(new Error(`Script bị kết thúc bởi tín hiệu ${signal}`));
			} else if (code !== 0) {
				reject(new Error(`Script thoát với mã ${code}`));
			} else {
				resolve();
			}
		});

		child.on("error", (error) => {
			if (timeoutId) clearTimeout(timeoutId);
			reject(error);
		});
	});
}
