// Thử lại thao tác file khi gặp lock tạm thời (hay gặp trên Windows khi file đang mở).
const RETRYABLE = new Set(["EBUSY", "EPERM", "ENOTEMPTY", "EACCES"]);

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
	let lastErr: unknown;
	for (let i = 0; i < attempts; i++) {
		try {
			return await fn();
		} catch (err) {
			lastErr = err;
			const code = (err as { code?: string }).code;
			if (!code || !RETRYABLE.has(code)) throw err;
			await delay(100 * 2 ** i); // 100ms, 200ms, 400ms
		}
	}
	throw lastErr;
}
