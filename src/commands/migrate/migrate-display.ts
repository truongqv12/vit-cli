/**
 * Hàm hiển thị UI cho lệnh `vit migrate`:
 * - printDryRunPlan: in kế hoạch dry-run dưới dạng panel
 * - printResults: in kết quả thực thi dưới dạng panel
 *
 * Tách riêng khỏi migrate-command.ts để giữ file chính dưới 200 dòng.
 */
import { log } from "../../shared/logger.js";
import { printPanel } from "../../shared/ui/ui.js";
import type { PanelZone } from "../../shared/ui/ui.js";
import { PROVIDERS } from "../portable/migrate-provider-registry.js";
import type {
	MigrateInstallResult,
	PortableItem,
	ProviderType,
	SkillInfo,
} from "../portable/migrate-types.js";

// ─── Kiểu dữ liệu nội bộ ───────────────────────────────────────────────────

export interface MigrateItemSet {
	agents: PortableItem[];
	commands: PortableItem[];
	skills: SkillInfo[];
	rules: PortableItem[];
	hooks: PortableItem[];
	config: PortableItem | null;
}

// ─── In kế hoạch dry-run bằng panel ───────────────────────────────────────

export function printDryRunPlan(
	providers: ProviderType[],
	items: MigrateItemSet,
	isGlobal: boolean,
): void {
	const totalItems =
		items.agents.length +
		items.commands.length +
		items.skills.length +
		items.rules.length +
		items.hooks.length +
		(items.config ? 1 : 0);

	// Zone thông tin scope
	const scopeZone: PanelZone = {
		label: "Scope",
		lines: [
			`${isGlobal ? "Global (~/.claude)" : "Project (.claude/)"}`,
			`Providers: ${providers.map((p) => PROVIDERS[p].displayName).join(", ")}`,
			`Tổng: ${totalItems} item × ${providers.length} provider`,
		],
	};

	const zones: PanelZone[] = [scopeZone];

	if (totalItems === 0) {
		zones.push({ label: "Kết quả", lines: ["Không tìm thấy item nào trong .claude/"] });
		printPanel({ title: "Vit Migrate — Dry Run", zones });
		return;
	}

	// Zone danh sách item theo loại
	const buildItemZone = (label: string, list: Array<{ name: string }>): PanelZone | null => {
		if (list.length === 0) return null;
		return {
			label: `${label} (${list.length})`,
			lines: list.map((item) => `→ ${item.name}`),
		};
	};

	const itemZones = [
		buildItemZone("Agents", items.agents),
		buildItemZone("Commands", items.commands),
		buildItemZone("Skills", items.skills),
		buildItemZone("Rules", items.rules),
		buildItemZone("Hooks", items.hooks),
		items.config ? buildItemZone("Config", [items.config]) : null,
	].filter((z): z is PanelZone => z !== null);

	zones.push(...itemZones);

	// Zone đường dẫn đích cho từng provider
	for (const provider of providers) {
		const cfg = PROVIDERS[provider];
		const a = isGlobal ? cfg.agents?.globalPath : cfg.agents?.projectPath;
		const c = isGlobal ? cfg.commands?.globalPath : cfg.commands?.projectPath;
		const s = isGlobal ? cfg.skills?.globalPath : cfg.skills?.projectPath;
		const conf = isGlobal ? cfg.config?.globalPath : cfg.config?.projectPath;
		const r = isGlobal ? cfg.rules?.globalPath : cfg.rules?.projectPath;

		const pathLines: string[] = [];
		if (items.agents.length > 0 && a) pathLines.push(`agents:   ${a}`);
		if (items.commands.length > 0 && c) pathLines.push(`commands: ${c}`);
		if (items.skills.length > 0 && s) pathLines.push(`skills:   ${s}`);
		if ((items.rules.length > 0 || items.config) && (r ?? conf)) {
			pathLines.push(`rules:    ${r ?? conf ?? ""}`);
		}

		if (pathLines.length > 0) {
			zones.push({ label: cfg.displayName, lines: pathLines });
		}
	}

	printPanel({ title: "Vit Migrate — Dry Run", zones });
	log.info("Dry-run: không ghi file. Chạy không có --dry-run để thực thi.");
}

// ─── In kết quả thực thi bằng panel ───────────────────────────────────────

export function printResults(results: MigrateInstallResult[]): void {
	const installed = results.filter((r) => r.success && !r.skipped && !r.overwritten);
	const updated = results.filter((r) => r.success && !r.skipped && r.overwritten);
	const skipped = results.filter((r) => r.skipped);
	const failed = results.filter((r) => !r.success);

	const zones: PanelZone[] = [];

	if (installed.length > 0) {
		zones.push({
			label: `Đã cài mới (${installed.length})`,
			lines: installed.map((r) => `→ [${r.provider}] ${r.portableType}/${r.itemName}`),
		});
	}
	if (updated.length > 0) {
		zones.push({
			label: `Đã cập nhật (${updated.length})`,
			lines: updated.map((r) => `→ [${r.provider}] ${r.portableType}/${r.itemName}`),
		});
	}
	if (skipped.length > 0) {
		zones.push({
			label: `Bỏ qua (${skipped.length})`,
			lines: skipped.map((r) => `→ [${r.provider}] ${r.portableType}/${r.itemName}: ${r.skipReason ?? ""}`),
		});
	}
	if (failed.length > 0) {
		zones.push({
			label: `Thất bại (${failed.length})`,
			lines: failed.map((r) => `✗ [${r.provider}] ${r.portableType}/${r.itemName}: ${r.error ?? "lỗi không xác định"}`),
		});
	}

	// Zone tóm tắt
	const summaryParts = [
		installed.length > 0 ? `${installed.length} mới` : "",
		updated.length > 0 ? `${updated.length} cập nhật` : "",
		skipped.length > 0 ? `${skipped.length} bỏ qua` : "",
		failed.length > 0 ? `${failed.length} lỗi` : "",
	].filter(Boolean);

	const summaryLine = summaryParts.join(", ") || "không có gì thay đổi";
	zones.push({ label: "Tóm tắt", lines: [summaryLine] });

	printPanel({ title: "Vit Migrate — Kết quả", zones });

	// Giữ nguyên exit code khi có lỗi (phải là 1 để CI phát hiện thất bại)
	if (failed.length > 0) {
		process.exitCode = 1;
	}
}
