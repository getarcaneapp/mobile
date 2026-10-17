/** Port of `EnvDocument` (Types/EnvDocument.swift) and EnvSourceEditing.swift: source-preserving `.env` edits. */
import { ComposeFormError } from './compose-errors';

type Range = { location: number; length: number };
export type EnvEntry = { line: number; name: string; value: string; range: Range };

const assignmentPattern = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

/** `NSString.lineRange(for:)`: the full line(s) containing `range`, including the terminator. */
function lineRange(source: string, range: Range): Range {
	let start = range.location;
	while (start > 0 && source[start - 1] !== '\n' && source[start - 1] !== '\r') start -= 1;
	let end = range.location + range.length;
	if (
		range.length > 0 &&
		(source[end - 1] === '\n' || (source[end - 1] === '\r' && source[end] !== '\n'))
	) {
		return { location: start, length: end - start };
	}
	while (end < source.length && source[end] !== '\n' && source[end] !== '\r') end += 1;
	if (source[end] === '\r') end += source[end + 1] === '\n' ? 2 : 1;
	else if (source[end] === '\n') end += 1;
	return { location: start, length: end - start };
}

const sameEntry = (a: EnvEntry, b: EnvEntry) =>
	a.line === b.line &&
	a.name === b.name &&
	a.range.location === b.range.location &&
	a.range.length === b.range.length &&
	a.value === b.value;

export class EnvDocument {
	readonly source: string;
	readonly entries: EnvEntry[];
	readonly unsupportedLines: number;

	static hasClosingQuote(text: string, quote: string): boolean {
		let escaped = false;
		for (const character of text) {
			if (escaped) {
				escaped = false;
				continue;
			}
			if (character === '\\') {
				escaped = true;
				continue;
			}
			if (character === quote) return true;
		}
		return false;
	}

	constructor(source: string) {
		this.source = source;
		const entries: EnvEntry[] = [];
		let unsupported = 0;
		const assignmentNames: string[] = [];
		let offset = 0;
		let lineNumber = 0;
		let multilineQuote: string | undefined;
		while (offset < source.length) {
			const range = lineRange(source, { location: offset, length: 0 });
			const raw = source.slice(range.location, range.location + range.length);
			const line = raw.replace(/^[\r\n]+|[\r\n]+$/g, '');
			const trimmed = line.replace(/^[ \t]+|[ \t]+$/g, '');
			const lineOffset = offset;
			offset = range.location + range.length;
			const currentLine = lineNumber;
			lineNumber += 1;
			if (multilineQuote !== undefined) {
				unsupported += 1;
				if (EnvDocument.hasClosingQuote(line, multilineQuote)) multilineQuote = undefined;
				continue;
			}
			if (trimmed === '' || trimmed.startsWith('#')) continue;
			const match = assignmentPattern.exec(line);
			if (!match) {
				unsupported += 1;
				continue;
			}
			const name = match[1]!;
			assignmentNames.push(name);
			const value = match[2]!;
			let decoded: string;
			if (value.startsWith("'") || value.startsWith('"')) {
				const quote = value[0]!;
				if (!EnvDocument.hasClosingQuote(value.slice(1), quote)) {
					unsupported += 1;
					multilineQuote = quote;
					continue;
				}
				if (!(value.length >= 2 && value.endsWith(quote))) {
					unsupported += 1;
					if (!EnvDocument.hasClosingQuote(value.slice(1), quote)) multilineQuote = quote;
					continue;
				}
				if (value.slice(1, -1).includes(quote) || value.includes('\\')) {
					unsupported += 1;
					continue;
				}
				decoded = value.slice(1, -1);
			} else {
				if (value.includes('#') || value.includes('\\')) {
					unsupported += 1;
					continue;
				}
				decoded = value;
			}
			entries.push({
				line: currentLine,
				name,
				value: decoded,
				range: { location: lineOffset + line.length - value.length, length: value.length }
			});
		}
		const counts = new Map<string, number>();
		for (const name of assignmentNames) counts.set(name, (counts.get(name) ?? 0) + 1);
		const duplicates = new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name));
		this.entries = entries.filter((entry) => !duplicates.has(entry.name));
		this.unsupportedLines =
			unsupported + entries.filter((entry) => duplicates.has(entry.name)).length;
	}

	setting(value: string, entry: EnvEntry): string {
		if (!this.entries.some((candidate) => sameEntry(candidate, entry)))
			throw ComposeFormError.changed;
		if (value === entry.value) return this.source;
		if (value.includes('\n') || value.includes('\r'))
			throw ComposeFormError.invalid('Edit multiline values in the text editor.');
		const old = this.source.slice(entry.range.location, entry.range.location + entry.range.length);
		let encoded: string;
		if (old.startsWith("'")) {
			if (value.includes("'"))
				throw ComposeFormError.invalid('Edit quoted values in the text editor.');
			encoded = "'" + value + "'";
		} else if (old.startsWith('"')) {
			if (value.includes('"') || value.includes('\\'))
				throw ComposeFormError.invalid('Edit escaped values in the text editor.');
			encoded = '"' + value + '"';
		} else {
			if (
				value.includes('#') ||
				value.includes('\\') ||
				value.includes("'") ||
				value.includes('"') ||
				value !== value.replace(/^[ \t]+|[ \t]+$/g, '')
			) {
				throw ComposeFormError.invalid('Edit quoted or escaped values in the text editor.');
			}
			encoded = value;
		}
		return (
			this.source.slice(0, entry.range.location) +
			encoded +
			this.source.slice(entry.range.location + entry.range.length)
		);
	}

	adding(name: string): string {
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
			throw ComposeFormError.invalid('Enter a valid variable name.');
		if (new RegExp('^\\s*(?:export\\s+)?' + name + '\\s*=', 'm').test(this.source))
			throw ComposeFormError.duplicate;
		const ending = this.source.includes('\r\n') ? '\r\n' : '\n';
		return (
			this.source +
			(this.source === '' || this.source.endsWith('\n') ? '' : ending) +
			name +
			'=' +
			ending
		);
	}

	removing(entry: EnvEntry): string {
		if (!this.entries.some((candidate) => sameEntry(candidate, entry))) return this.source;
		const range = lineRange(this.source, entry.range);
		return this.source.slice(0, range.location) + this.source.slice(range.location + range.length);
	}
}
