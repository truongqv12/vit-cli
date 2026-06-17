/**
 * Danh sách hook "generated-context" — đồ nghề nội bộ của engine để bơm context vào Claude Code
 * (SessionStart, UserPromptSubmit, SubagentStart…). Đây KHÔNG phải hook của user.
 *
 * Lý do loại khỏi migrate sang provider khác (codex/opencode/antigravity):
 *   - Agent đích không có model hook event tương ứng → không bao giờ chạy.
 *   - Nội dung sinh ra theo định dạng <system-reminder> riêng của Claude → nhiễu/sai trên agent khác.
 *   - Phụ thuộc hạ tầng Claude (transcript parser, CLAUDE_PROJECT_DIR, shape settings.json).
 *
 * Giữ đồng bộ với danh sách hook mặc định của engine.
 */
import { basename } from "node:path";

const GENERATED_CONTEXT_HOOK_FILENAMES = new Set([
	"cook-after-plan-reminder.cjs",
	"dev-rules-reminder.cjs",
	"plan-format-kanban.cjs",
	"session-init.cjs",
	"session-state.cjs",
	"subagent-init.cjs",
	"team-context-inject.cjs",
	"teammate-idle-handler.cjs",
	"usage-context-awareness.cjs",
]);

/** True nếu tên file là hook generated-context (so basename, chấp nhận tiền tố "<x>-<name>") */
export function isGeneratedContextHookName(name: string): boolean {
	const normalized = basename(name.replace(/\\/g, "/"));
	return Array.from(GENERATED_CONTEXT_HOOK_FILENAMES).some(
		(hookName) => normalized === hookName || normalized.endsWith(`-${hookName}`),
	);
}
