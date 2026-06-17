// Merge settings.json: hooks union (dedup theo command, theo matcher), giữ key user,
// engine ghi đè các key engine-owned. User hook chạy trước, engine hook thêm sau.
import { normalizeCommand } from "./command-normalizer.js";
import type { HookCommand, HookEntry, HooksMap, SettingsJson } from "./settings-types.js";

// Key do engine quản — luôn lấy bản engine (mới) khi merge.
const ENGINE_OWNED_KEYS = new Set([
	"$schema",
	"statusLine",
	"skillListingBudgetFraction",
	"skillListingMaxDescChars",
	"attribution",
]);

// Lấy mọi command string trong 1 entry (hỗ trợ cả dạng {hooks:[...]} lẫn {command}).
function entryCommands(entry: HookEntry): string[] {
	const cmds: string[] = [];
	if (Array.isArray(entry.hooks)) {
		for (const h of entry.hooks) if (h.command) cmds.push(h.command);
	}
	if (entry.command) cmds.push(entry.command);
	return cmds;
}

// Gộp inner hooks của 2 entry cùng matcher, dedup theo command đã chuẩn hoá.
function unionInnerHooks(target: HookEntry, source: HookEntry): void {
	if (!Array.isArray(source.hooks)) return;
	if (!Array.isArray(target.hooks)) target.hooks = [];
	const seen = new Set(
		target.hooks.map((h) => normalizeCommand(h.command)).filter(Boolean) as string[],
	);
	for (const h of source.hooks) {
		const key = normalizeCommand(h.command);
		if (key && seen.has(key)) continue;
		target.hooks.push(structuredClone(h) as HookCommand);
		if (key) seen.add(key);
	}
}

// Merge entries của 1 event: giữ entry user trước, gộp/append entry engine.
function mergeEventEntries(sourceEntries: HookEntry[], destEntries: HookEntry[]): HookEntry[] {
	const merged: HookEntry[] = destEntries.map((e) => structuredClone(e));
	const matcherIndex = new Map<string, number>();
	for (let i = 0; i < merged.length; i++) {
		matcherIndex.set(merged[i].matcher ?? "", i);
	}

	for (const srcEntry of sourceEntries) {
		const key = srcEntry.matcher ?? "";
		const idx = matcherIndex.get(key);
		if (idx !== undefined) {
			unionInnerHooks(merged[idx], srcEntry);
		} else {
			// Chỉ dedup cross-entry cho entry PHẲNG thật (không matcher, không hooks[]).
			// Entry có matcher mới luôn push — đã không trùng matcher nào, dedup cross-matcher
			// sẽ làm mất wiring (vd PreToolUse "Write" vs "Bash|...Write" chia sẻ command).
			const isFlatEntry = !Array.isArray(srcEntry.hooks) && !!srcEntry.command;
			if (isFlatEntry) {
				const existing = new Set(
					merged.flatMap(entryCommands).map(normalizeCommand).filter(Boolean) as string[],
				);
				const srcCmds = entryCommands(srcEntry).map(normalizeCommand).filter(Boolean);
				if (srcCmds.length > 0 && srcCmds.every((c) => existing.has(c))) continue;
			}
			merged.push(structuredClone(srcEntry));
			matcherIndex.set(key, merged.length - 1);
		}
	}
	return merged;
}

export function mergeHooks(sourceHooks: HooksMap, destHooks: HooksMap): HooksMap {
	const merged: HooksMap = {};
	// Giữ event chỉ có ở user.
	for (const [event, entries] of Object.entries(destHooks)) {
		merged[event] = entries.map((e) => structuredClone(e));
	}
	for (const [event, srcEntries] of Object.entries(sourceHooks)) {
		merged[event] = mergeEventEntries(srcEntries, merged[event] ?? []);
	}
	return merged;
}

// Merge engine settings vào user settings: giữ key user, engine-owned ghi đè, key mới thêm.
export function mergeSettings(engine: SettingsJson, user: SettingsJson): SettingsJson {
	const merged: SettingsJson = structuredClone(user);

	if (engine.hooks) {
		merged.hooks = mergeHooks(engine.hooks, user.hooks ?? {});
	}

	for (const [key, value] of Object.entries(engine)) {
		if (key === "hooks") continue;
		if (ENGINE_OWNED_KEYS.has(key) || !(key in merged)) {
			merged[key] = structuredClone(value);
		}
	}
	return merged;
}
