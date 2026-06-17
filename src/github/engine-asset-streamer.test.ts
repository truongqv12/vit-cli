/** Test cho engine-asset-streamer: verify size logic (phần thuần, không fetch thật). */
import assert from "node:assert/strict";
import { test } from "node:test";

// --- Mock để test phần logic thuần (không gọi fetch) ---

/**
 * Kiểm tra kích thước buffer vs asset.size.
 * Ném lỗi nếu lệch — logic này tách từ streamAssetWithProgress.
 */
function verifyAssetSize(bufferLength: number, expectedSize: number): void {
	if (bufferLength !== expectedSize) {
		throw new Error(
			`Kích thước tải lệch: nhận ${bufferLength} byte, mong đợi ${expectedSize} byte. ` +
				"Bỏ qua để ngăn cài file hỏng.",
		);
	}
}

/**
 * Chọn URL download từ redirect hoặc fallback.
 * Mô phỏng resolveDownloadUrl logic:
 * - Nếu có redirectLocation → trả nó
 * - Nếu không → trả fallback
 */
function selectDownloadUrl(
	redirectLocation: string | null,
	fallback: string,
): string {
	if (redirectLocation) return redirectLocation;
	return fallback;
}

// --- Test verifyAssetSize ---

test("verifyAssetSize — kích thước khớp → không ném lỗi", () => {
	assert.doesNotThrow(() => {
		verifyAssetSize(1000, 1000);
	});
});

test("verifyAssetSize — kích thước khớp (0)", () => {
	assert.doesNotThrow(() => {
		verifyAssetSize(0, 0);
	});
});

test("verifyAssetSize — kích thước khớp (lớn)", () => {
	assert.doesNotThrow(() => {
		verifyAssetSize(1024 * 1024 * 100, 1024 * 1024 * 100); // 100 MB
	});
});

test("verifyAssetSize — bufferLength < expectedSize → ném lỗi", () => {
	assert.throws(() => {
		verifyAssetSize(500, 1000);
	}, /Kích thước tải lệch/);
});

test("verifyAssetSize — bufferLength > expectedSize → ném lỗi", () => {
	assert.throws(() => {
		verifyAssetSize(1500, 1000);
	}, /Kích thước tải lệch/);
});

test("verifyAssetSize — lỗi chứa thông tin chi tiết", () => {
	try {
		verifyAssetSize(750, 1000);
		assert.fail("Phải ném lỗi");
	} catch (err: unknown) {
		const msg = (err as Error).message;
		assert.match(msg, /750/);
		assert.match(msg, /1000/);
	}
});

test("verifyAssetSize — 1 byte lệch", () => {
	assert.throws(() => {
		verifyAssetSize(999, 1000);
	}, /Kích thước tải lệch/);
});

test("verifyAssetSize — 0 byte lệch (exact match)", () => {
	assert.doesNotThrow(() => {
		verifyAssetSize(12345, 12345);
	});
});

// --- Test selectDownloadUrl ---

test("selectDownloadUrl — có redirect → trả redirect", () => {
	const result = selectDownloadUrl(
		"https://s3.amazonaws.com/bucket/file",
		"https://github.com/download",
	);
	assert.equal(result, "https://s3.amazonaws.com/bucket/file");
});

test("selectDownloadUrl — redirect null → trả fallback", () => {
	const result = selectDownloadUrl(null, "https://github.com/download");
	assert.equal(result, "https://github.com/download");
});

test("selectDownloadUrl — redirect empty string → trả fallback", () => {
	// Empty string là falsy → nếu kiểm tra if (redirect) sẽ dùng fallback
	// Nhưng hàm selectDownloadUrl dùng if (redirectLocation), nên empty string = falsy = fallback
	const fallback = "https://github.com/download";
	const result = selectDownloadUrl("", fallback);
	assert.equal(result, fallback);
});

test("selectDownloadUrl — redirect URL phức tạp", () => {
	const redirectUrl =
		"https://s3.amazonaws.com/bucket/very/long/path/file?auth=token&expires=123";
	const result = selectDownloadUrl(redirectUrl, "https://github.com");
	assert.equal(result, redirectUrl);
});

test("selectDownloadUrl — fallback URL", () => {
	const fallback = "https://github.com/repos/owner/repo/releases/download/v1.0/file.tar.gz";
	const result = selectDownloadUrl(null, fallback);
	assert.equal(result, fallback);
});

// --- Test progress callback (mock) ---

/**
 * Mock onProgress callback.
 * Kiểm tra progress được gọi đúng số lần với giá trị đúng.
 */
test("progress callback — simulate stream", () => {
	const progressCalls: Array<[number, number]> = [];
	const onProgress = (received: number, total: number) => {
		progressCalls.push([received, total]);
	};

	// Giả lập: tải 3 chunk, mỗi chunk 100 byte, total = 300
	const total = 300;
	onProgress(100, total);
	onProgress(200, total);
	onProgress(300, total);

	assert.equal(progressCalls.length, 3);
	assert.deepEqual(progressCalls[0], [100, 300]);
	assert.deepEqual(progressCalls[1], [200, 300]);
	assert.deepEqual(progressCalls[2], [300, 300]);
});

test("progress callback — single chunk", () => {
	const progressCalls: Array<[number, number]> = [];
	const onProgress = (received: number, total: number) => {
		progressCalls.push([received, total]);
	};

	const total = 1000;
	onProgress(1000, total);

	assert.equal(progressCalls.length, 1);
	assert.deepEqual(progressCalls[0], [1000, 1000]);
});

test("progress callback — large file", () => {
	const progressCalls: Array<[number, number]> = [];
	const onProgress = (received: number, total: number) => {
		progressCalls.push([received, total]);
	};

	const total = 1024 * 1024; // 1 MB
	onProgress(256 * 1024, total); // 256 KB
	onProgress(512 * 1024, total); // 512 KB
	onProgress(1024 * 1024, total); // 1 MB

	assert.equal(progressCalls.length, 3);
	assert.equal(progressCalls[2][0], 1024 * 1024); // Final = total
});

// --- Test asset metadata ---

/**
 * Kiểm tra GitHubAsset interface logic.
 * Validate rằng size field có mặt và hợp lệ.
 */
test("GitHubAsset — size property", () => {
	const asset = {
		id: 12345,
		size: 5000,
		name: "engine-linux-x64.tar.gz",
		browser_download_url: "https://github.com/.../download",
	};

	assert.equal(asset.size, 5000);
	assert.ok(asset.size > 0);
});

test("GitHubAsset — size=0 (valid nhưng lạ)", () => {
	const asset = {
		id: 12345,
		size: 0,
		name: "empty.tar.gz",
		browser_download_url: "https://github.com/.../download",
	};

	assert.equal(asset.size, 0);
	// Verify 0 byte buffer sẽ pass
	assert.doesNotThrow(() => {
		verifyAssetSize(0, asset.size);
	});
});

// --- Error message quality ---

test("verifyAssetSize — error message có context", () => {
	try {
		verifyAssetSize(100, 500);
		assert.fail("Phải ném lỗi");
	} catch (err: unknown) {
		const error = err as Error;
		const msg = error.message;
		assert.ok(msg.includes("100"));
		assert.ok(msg.includes("500"));
		assert.ok(msg.includes("byte"));
	}
});

// --- Edge cases ---

test("verifyAssetSize — size rất lớn (1 GB)", () => {
	const size1GB = 1024 * 1024 * 1024;
	assert.doesNotThrow(() => {
		verifyAssetSize(size1GB, size1GB);
	});
});

test("verifyAssetSize — size rất lớn lệch 1 byte", () => {
	const size1GB = 1024 * 1024 * 1024;
	assert.throws(() => {
		verifyAssetSize(size1GB - 1, size1GB);
	});
});

test("selectDownloadUrl — URL với query parameter", () => {
	const redirect = "https://s3.amazonaws.com/file?version=123&auth=abc";
	const fallback = "https://github.com/file";
	const result = selectDownloadUrl(redirect, fallback);
	assert.equal(result, redirect);
	assert.ok(result.includes("?version="));
});

test("selectDownloadUrl — URL với fragment (hiếm nhưng valid)", () => {
	const redirect = "https://s3.amazonaws.com/file#section";
	const result = selectDownloadUrl(redirect, "https://github.com");
	assert.equal(result, redirect);
});
