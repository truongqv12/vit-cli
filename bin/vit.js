#!/usr/bin/env node
// Điểm vào nhị phân `vit`. Nạp bản build ESM trong dist/.
import("../dist/index.js").catch((err) => {
	console.error("[X] Không nạp được vit CLI. Bạn đã chạy `npm run build` chưa?");
	console.error(err?.message ?? err);
	process.exit(1);
});
