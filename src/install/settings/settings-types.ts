// Kiểu cho settings.json của Claude Code (phần vit quan tâm: hooks + key engine).

export interface HookCommand {
	type?: string;
	command?: string;
	[k: string]: unknown;
}

// Một entry hook: có thể là {matcher, hooks:[...]} hoặc dạng phẳng {command}.
export interface HookEntry {
	matcher?: string;
	hooks?: HookCommand[];
	command?: string;
	type?: string;
	[k: string]: unknown;
}

export type HooksMap = Record<string, HookEntry[]>;

export interface SettingsJson {
	hooks?: HooksMap;
	statusLine?: unknown;
	[k: string]: unknown;
}
