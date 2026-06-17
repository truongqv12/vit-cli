// Logger ASCII đơn giản — không emoji, hợp mọi terminal (kể cả Windows cũ).
import pc from "picocolors";

export const log = {
	ok: (msg: string) => console.log(`${pc.green("[OK]")} ${msg}`),
	info: (msg: string) => console.log(`${pc.cyan("[i]")} ${msg}`),
	warn: (msg: string) => console.log(`${pc.yellow("[!]")} ${msg}`),
	error: (msg: string) => console.error(`${pc.red("[X]")} ${msg}`),
	plain: (msg: string) => console.log(msg),
};
