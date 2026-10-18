export function isEchoOfEmittedText(pending: string[], value: string): boolean {
	const index = pending.indexOf(value);
	if (index === -1) return false;
	pending.splice(0, index + 1);
	return true;
}

const maximumPendingEchoes = 64;

export function rememberEmittedText(pending: string[], text: string) {
	pending.push(text);
	if (pending.length > maximumPendingEchoes) pending.shift();
}
