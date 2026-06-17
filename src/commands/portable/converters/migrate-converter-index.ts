/**
 * Converter index — điều phối convert theo format được khai báo trong provider registry.
 */
import type { ConversionFormat, ConversionResult, PortableItem, ProviderType } from "../migrate-types.js";
import { convertCommandToCodexSkill } from "./migrate-converter-command-to-codex-skill.js";
import { convertFmToCodexToml } from "./migrate-converter-codex-toml.js";
import { convertDirectCopy } from "./migrate-converter-direct-copy.js";
import { convertFmToFm } from "./migrate-converter-fm-to-fm.js";
import { convertMdStrip } from "./migrate-converter-md-strip.js";

/** Convert một PortableItem sang định dạng provider đích */
export function convertItem(
	item: PortableItem,
	format: ConversionFormat,
	provider: ProviderType,
): ConversionResult {
	try {
		switch (format) {
			case "direct-copy":
				return convertDirectCopy(item, provider);
			case "fm-to-fm":
				return convertFmToFm(item);
			case "fm-to-codex-toml":
				return convertFmToCodexToml(item);
			case "command-to-codex-skill":
				return convertCommandToCodexSkill(item);
			case "md-strip":
				return convertMdStrip(item, provider);
			default: {
				const _exhaustive: never = format;
				return {
					content: item.body,
					filename: `${item.name}.md`,
					warnings: [`Format không được nhận diện: ${_exhaustive as string}`],
				};
			}
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Lỗi không xác định";
		return {
			content: "",
			filename: `${item.name}.md`,
			warnings: [`Chuyển đổi thất bại cho "${item.name}" (format: ${format}): ${msg}`],
			error: msg,
		};
	}
}
