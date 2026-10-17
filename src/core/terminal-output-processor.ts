/**
 * Port of Utils/TerminalOutputProcessor.swift: a byte-level terminal frame
 * decoder (UTF-8 with replacement, ANSI CSI/OSC stripping, DSR detection), a
 * bounded line buffer, and the follow-the-bottom behavior.
 *
 * Pure TS (no React Native imports).
 */
import { RemoteDataLimits } from '@/core/networking/remote-data-limits';

export type TerminalDecodedChunk = { text: string; dsrReplyCount: number };

type EscapeState =
	| { kind: 'text' }
	| { kind: 'escape' }
	| { kind: 'csi'; parameters: number[] }
	| { kind: 'osc'; escapePending: boolean }
	| { kind: 'designator' };

const replacement = '�';

export class TerminalFrameDecoder {
	private static readonly maximumControlSequenceBytes = 1_024;
	private escapeState: EscapeState = { kind: 'text' };
	private utf8Value = 0;
	private utf8Minimum = 0;
	private utf8ContinuationCount = 0;
	private output = '';

	decode(data: Uint8Array): TerminalDecodedChunk {
		this.output = '';
		let dsrReplyCount = 0;
		const limit = Math.min(data.length, RemoteDataLimits.maximumTerminalFrameBytes);
		for (let index = 0; index < limit; index++) {
			const byte = data[index]!;
			const state = this.escapeState;
			switch (state.kind) {
				case 'text':
					this.consumeText(byte);
					break;
				case 'escape':
					this.consumeEscape(byte);
					break;
				case 'csi':
					if (byte >= 0x40 && byte <= 0x7e) {
						if (byte === 0x6e && state.parameters.length === 1 && state.parameters[0] === 0x36)
							dsrReplyCount += 1;
						this.escapeState = { kind: 'text' };
					} else if (state.parameters.length < TerminalFrameDecoder.maximumControlSequenceBytes) {
						state.parameters.push(byte);
					} else {
						this.escapeState = { kind: 'text' };
					}
					break;
				case 'osc':
					if (state.escapePending && byte === 0x5c) this.escapeState = { kind: 'text' };
					else if (!state.escapePending && byte === 0x07) this.escapeState = { kind: 'text' };
					else this.escapeState = { kind: 'osc', escapePending: byte === 0x1b };
					break;
				case 'designator':
					this.escapeState = { kind: 'text' };
					break;
			}
		}
		const text = this.output;
		this.output = '';
		return { text, dsrReplyCount };
	}

	finish(): TerminalDecodedChunk {
		this.output = '';
		this.flushIncompleteUTF8();
		this.escapeState = { kind: 'text' };
		const text = this.output;
		this.output = '';
		return { text, dsrReplyCount: 0 };
	}

	private consumeText(byte: number) {
		if (byte === 0x1b) {
			this.flushIncompleteUTF8();
			this.escapeState = { kind: 'escape' };
		} else if (byte !== 0x07) {
			this.appendTextByte(byte);
		}
	}

	private consumeEscape(byte: number) {
		switch (byte) {
			case 0x5b:
				this.escapeState = { kind: 'csi', parameters: [] };
				break;
			case 0x5d:
				this.escapeState = { kind: 'osc', escapePending: false };
				break;
			case 0x28:
			case 0x29:
			case 0x2a:
			case 0x2b:
			case 0x25:
			case 0x23:
				this.escapeState = { kind: 'designator' };
				break;
			default:
				this.escapeState = { kind: 'text' };
		}
	}

	private appendTextByte(current: number) {
		for (;;) {
			if (this.utf8ContinuationCount === 0) {
				if (current <= 0x7f) {
					this.output += String.fromCharCode(current);
				} else if (current >= 0xc2 && current <= 0xdf) {
					this.startSequence(current & 0x1f, 0x80, 1);
				} else if (current >= 0xe0 && current <= 0xef) {
					this.startSequence(current & 0x0f, 0x800, 2);
				} else if (current >= 0xf0 && current <= 0xf4) {
					this.startSequence(current & 0x07, 0x10000, 3);
				} else {
					this.output += replacement;
				}
				return;
			}

			if (current < 0x80 || current > 0xbf) {
				this.output += replacement;
				this.resetUTF8();
				continue;
			}

			this.utf8Value = (this.utf8Value << 6) | (current & 0x3f);
			this.utf8ContinuationCount -= 1;
			if (this.utf8ContinuationCount !== 0) return;

			const scalar = this.utf8Value;
			const valid =
				scalar >= this.utf8Minimum && scalar <= 0x10ffff && !(scalar >= 0xd800 && scalar <= 0xdfff);
			this.output += valid ? String.fromCodePoint(scalar) : replacement;
			this.resetUTF8();
			return;
		}
	}

	private startSequence(value: number, minimum: number, continuationCount: number) {
		this.utf8Value = value;
		this.utf8Minimum = minimum;
		this.utf8ContinuationCount = continuationCount;
	}

	private flushIncompleteUTF8() {
		if (this.utf8ContinuationCount === 0) return;
		this.output += replacement;
		this.resetUTF8();
	}

	private resetUTF8() {
		this.utf8Value = 0;
		this.utf8Minimum = 0;
		this.utf8ContinuationCount = 0;
	}
}

export type TerminalOutputLine = { id: number; text: string };

export type TerminalOutputSnapshot = { lines: TerminalOutputLine[]; fullText: string };

/** Follows the bottom until the user scrolls away; reaching the bottom resumes. */
export class TerminalOutputFollowBehavior {
	isFollowing = true;

	observe(isAtBottom: boolean, userIsScrolling: boolean) {
		if (isAtBottom) this.isFollowing = true;
		else if (userIsScrolling) this.isFollowing = false;
	}

	resume() {
		this.isFollowing = true;
	}
}

export class TerminalOutputBuffer {
	private lines: TerminalOutputLine[] = [];
	private nextID = 0;
	private pendingCarriageReturn = false;
	readonly maxLines: number;
	readonly maxCharacters: number;

	constructor(maxLines = 2_000, maxCharacters = 200_000) {
		this.maxLines = Math.max(1, maxLines);
		this.maxCharacters = Math.max(1, maxCharacters);
	}

	append(text: string) {
		for (const character of text) {
			if (this.pendingCarriageReturn) {
				this.appendNewline();
				this.pendingCarriageReturn = false;
				if (character === '\n') continue;
			}
			switch (character) {
				case '\r':
					this.pendingCarriageReturn = true;
					break;
				case '\n':
					this.appendNewline();
					break;
				default: {
					this.ensureCurrentLine();
					const last = this.lines[this.lines.length - 1]!;
					this.lines[this.lines.length - 1] = { id: last.id, text: last.text + character };
				}
			}
		}
		this.trimToLimits();
	}

	clear() {
		this.lines = [];
		this.nextID = 0;
		this.pendingCarriageReturn = false;
	}

	snapshot(): TerminalOutputSnapshot {
		return { lines: [...this.lines], fullText: this.lines.map((line) => line.text).join('\n') };
	}

	lineSnapshot(): TerminalOutputLine[] {
		return [...this.lines];
	}

	private ensureCurrentLine() {
		if (this.lines.length > 0) return;
		this.lines.push({ id: this.nextID, text: '' });
		this.nextID += 1;
	}

	private appendNewline() {
		this.ensureCurrentLine();
		this.lines.push({ id: this.nextID, text: '' });
		this.nextID += 1;
	}

	private trimToLimits() {
		if (this.lines.length > this.maxLines) this.lines.splice(0, this.lines.length - this.maxLines);
		let characterCount = this.retainedCharacterCount();
		let drop = 0;
		while (this.lines.length - drop > 1 && characterCount > this.maxCharacters) {
			// Removing a line removes its characters plus one joining newline.
			characterCount -= Array.from(this.lines[drop]!.text).length + 1;
			drop += 1;
		}
		if (drop > 0) this.lines.splice(0, drop);
		const first = this.lines[0];
		if (characterCount > this.maxCharacters && first) {
			const characters = Array.from(first.text);
			this.lines[0] = {
				id: first.id,
				text: characters.slice(characters.length - this.maxCharacters).join('')
			};
		}
	}

	private retainedCharacterCount() {
		return this.lines.reduce(
			(total, line) => total + Array.from(line.text).length,
			Math.max(0, this.lines.length - 1)
		);
	}
}

/** The Swift actor, as a plain class (JS is single-threaded). */
export class TerminalOutputProcessor {
	private decoder = new TerminalFrameDecoder();
	private buffer = new TerminalOutputBuffer();

	/** Appends a frame and returns how many cursor-position (DSR) replies it asked for. */
	append(data: Uint8Array): number {
		const decoded = this.decoder.decode(data);
		this.buffer.append(decoded.text);
		return decoded.dsrReplyCount;
	}

	finish() {
		this.buffer.append(this.decoder.finish().text);
	}

	clear() {
		this.decoder = new TerminalFrameDecoder();
		this.buffer.clear();
	}

	snapshot() {
		return this.buffer.snapshot();
	}

	lineSnapshot() {
		return this.buffer.lineSnapshot();
	}
}
