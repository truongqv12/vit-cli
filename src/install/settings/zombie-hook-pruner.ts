// Prune wiring hook "chết": command trỏ tới .claude/hooks/<file> không tồn tại trên đĩa.
// Chạy sau khi reconcile để dọn hook engine đã xoá (deletions[]) còn sót trong settings.
import { existsSync } from "node:fs";
import path from "node:path";
import { normalizeCommand } from "./command-normalizer.js";
import type { HookEntry, HooksMap } from "./settings-types.js";

// Trích path .claude/...cjs (hoặc .js) trong command; null nếu không trỏ tới hook file.
function hookFileRef(command?: string): string | null {
	if (!command) return null;
	const m = normalizeCommand(command).match(/\.claude\/([^\s"']+\.c?js)\b/);
	return m ? m[1] : null;
}

// command còn "sống" nếu: không trỏ hook file, HOẶC file tồn tại trên đĩa.
function isLiveCommand(command: string | undefined, projectRoot: string): boolean {
	const ref = hookFileRef(command);
	if (!ref) return true;
	return existsSync(path.join(projectRoot, ".claude", ref));
}

export interface PruneResult {
	pruned: HooksMap;
	removed: string[];
}

export function pruneZombieHooks(hooks: HooksMap, projectRoot: string): PruneResult {
	const pruned: HooksMap = {};
	const removed: string[] = [];

	for (const [event, entries] of Object.entries(hooks)) {
		const keptEntries: HookEntry[] = [];
		for (const entry of entries) {
			const next: HookEntry = structuredClone(entry);

			if (Array.isArray(next.hooks)) {
				next.hooks = next.hooks.filter((h) => {
					if (isLiveCommand(h.command, projectRoot)) return true;
					if (h.command) removed.push(h.command);
					return false;
				});
			}

			// Entry phẳng {command} trỏ hook chết -> bỏ.
			if (next.command && !isLiveCommand(next.command, projectRoot)) {
				removed.push(next.command);
				continue;
			}

			// Bỏ entry rỗng (có khoá hooks nhưng đã sạch).
			const hasInner = Array.isArray(next.hooks) && next.hooks.length > 0;
			const isFlat = typeof next.command === "string";
			if (!hasInner && !isFlat && "hooks" in next) continue;

			keptEntries.push(next);
		}
		if (keptEntries.length > 0) pruned[event] = keptEntries;
	}

	return { pruned, removed };
}
