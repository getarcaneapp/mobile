import { ComposeDocument } from './compose-document';
import { ComposeDocumentError, ComposeFormError } from './compose-errors';

export type ComposeEntryKind = 'port' | 'mount' | 'keyValue' | 'network';

const swiftInt = (value: string) => (/^[+-]?[0-9]+$/.test(value) ? Number(value) : undefined);

export class ComposeEntryDraft {
	source = '';
	target = '';
	address = '';
	option = 'tcp';
	readOnly = false;
	private original = '';
	private longForm = false;
	private originalFields: string[] | undefined;
	private get fields(): string[] {
		return [this.source, this.target, this.address, this.option, String(this.readOnly)];
	}

	constructor(raw?: string, kind?: ComposeEntryKind) {
		if (raw === undefined || kind === undefined) return;
		this.original = raw;
		if (raw === '') return;
		const document = ComposeDocument.parse(
			'entry:\n' +
				raw
					.split('\n')
					.map((line) => '  ' + line)
					.join('\n')
		);
		const scalar = document.scalar(['entry']);
		if (scalar !== undefined) {
			switch (kind) {
				case 'port': {
					if (scalar.includes('${') || scalar.includes('[')) throw ComposeDocumentError.unsupported;
					const proto = scalar.split('/');
					if (proto.length > 2) throw ComposeDocumentError.unsupported;
					if (proto.length === 2) this.option = proto[1]!;
					const parts = proto[0]!.split(':');
					if (parts.length < 1 || parts.length > 3) throw ComposeDocumentError.unsupported;
					this.target = parts[parts.length - 1] ?? '';
					if (parts.length > 1) this.source = parts[parts.length - 2]!;
					if (parts.length === 3) this.address = parts[0]!;
					break;
				}
				case 'mount': {
					if (scalar.includes('${') || scalar.includes('\\'))
						throw ComposeDocumentError.unsupported;
					const parts = scalar.split(':');
					if (parts.length < 1 || parts.length > 3) throw ComposeDocumentError.unsupported;
					if (parts.length === 1) {
						this.target = parts[0]!;
					} else {
						this.source = parts[0]!;
						this.target = parts[1]!;
					}
					if (parts.length === 3) {
						if (parts[2] !== 'ro' && parts[2] !== 'rw') throw ComposeDocumentError.unsupported;
						this.readOnly = parts[2] === 'ro';
					}
					break;
				}
				case 'keyValue': {
					const separator = scalar.indexOf('=');
					this.source = separator === -1 ? scalar : scalar.slice(0, separator);
					this.target = separator === -1 ? '' : scalar.slice(separator + 1);
					break;
				}
				case 'network':
					this.source = scalar;
					break;
			}
		} else {
			if (!(kind === 'port' || kind === 'mount') || !document.isEditable(['entry']))
				throw ComposeDocumentError.unsupported;
			this.longForm = true;
			const fields =
				kind === 'port'
					? ['target', 'published', 'host_ip', 'protocol']
					: ['source', 'target', 'read_only', 'type'];
			for (const field of fields) {
				if (
					document.rawValue(['entry', field]) !== undefined &&
					document.scalar(['entry', field]) === undefined
				) {
					throw ComposeDocumentError.unsupported;
				}
			}
			this.source = document.scalar(['entry', kind === 'port' ? 'published' : 'source']) ?? '';
			this.target = document.scalar(['entry', 'target']) ?? '';
			this.address = document.scalar(['entry', 'host_ip']) ?? '';
			this.option = document.scalar(['entry', 'protocol']) ?? 'tcp';
			const readOnly = document.scalar(['entry', 'read_only']);
			if (readOnly !== undefined) {
				if (!['true', 'false'].includes(readOnly.toLowerCase()))
					throw ComposeDocumentError.unsupported;
				this.readOnly = readOnly.toLowerCase() === 'true';
			}
		}
		this.originalFields = this.fields;
	}

	with(
		changes: Partial<
			Pick<ComposeEntryDraft, 'source' | 'target' | 'address' | 'option' | 'readOnly'>
		>
	): ComposeEntryDraft {
		const copy = Object.assign(
			Object.create(ComposeEntryDraft.prototype) as ComposeEntryDraft,
			this
		);
		return Object.assign(copy, changes);
	}

	yaml(kind: ComposeEntryKind): string {
		const fields = this.fields;
		if (this.originalFields && this.originalFields.every((field, i) => field === fields[i]))
			return this.original;
		switch (kind) {
			case 'port':
				if (
					!this.validPort(this.target) ||
					!(this.source === '' || this.validPort(this.source)) ||
					!['tcp', 'udp', 'sctp'].includes(this.option)
				) {
					throw ComposeFormError.invalid('Enter ports between 1 and 65535, or a valid port range.');
				}
				if (!(this.address === '' || this.source !== ''))
					throw ComposeFormError.invalid('A host address requires a host port.');
				break;
			case 'mount':
				if (
					!this.target.startsWith('/') ||
					this.target.includes(':') ||
					this.source.includes(':')
				) {
					throw ComposeFormError.invalid('Enter an absolute container path without colons.');
				}
				break;
			case 'keyValue':
				if (this.source === '' || this.source.includes('=') || this.source.includes('\n'))
					throw ComposeFormError.invalid('Enter a valid name.');
				break;
			case 'network':
				if (this.source === '') throw ComposeFormError.invalid('Enter a network name.');
				break;
		}
		if (this.longForm) {
			let result = this.original;
			if (kind === 'mount' && this.originalFields?.[0] !== this.source) {
				const document = ComposeDocument.parse(result);
				const oldType = document.scalar(['type']);
				const newType =
					this.source.startsWith('/') || this.source.startsWith('.') || this.source.startsWith('~')
						? 'bind'
						: 'volume';
				if (oldType !== newType) {
					if (
						!(oldType === undefined || oldType === 'bind' || oldType === 'volume') ||
						document.keys([]).some((key) => ['bind', 'volume', 'tmpfs'].includes(key))
					) {
						throw ComposeFormError.invalid(
							'This mount has type-specific options. Change its type and source in All settings.'
						);
					}
					result = document.setting(newType, ['type']);
				}
			}
			const values: [string, string][] =
				kind === 'port'
					? [
							['target', this.target],
							['published', this.source],
							['host_ip', this.address],
							['protocol', this.option]
						]
					: [
							['source', this.source],
							['target', this.target],
							['read_only', this.readOnly ? 'true' : 'false']
						];
			for (const [key, value] of values) {
				const fieldIndex =
					key === 'source' || key === 'published'
						? 0
						: key === 'target'
							? 1
							: key === 'host_ip'
								? 2
								: key === 'protocol'
									? 3
									: 4;
				if (this.originalFields?.[fieldIndex] === value) continue;
				const document = ComposeDocument.parse(result);
				if (
					document.scalar([key]) === value ||
					(value === '' && document.rawValue([key]) === undefined)
				)
					continue;
				if (value === '') {
					result = document.removing([key]);
				} else {
					result = document.setting(
						key === 'read_only' || (key === 'target' && kind === 'port')
							? value
							: ComposeDocument.quoted(value),
						[key]
					);
				}
			}
			return result;
		}
		let scalar: string;
		switch (kind) {
			case 'port':
				scalar =
					(this.address === '' ? '' : this.address + ':') +
					(this.source === '' ? '' : this.source + ':') +
					this.target +
					'/' +
					this.option;
				break;
			case 'mount':
				scalar =
					(this.source === '' ? '' : this.source + ':') +
					this.target +
					(this.readOnly ? ':ro' : '');
				break;
			case 'keyValue':
				scalar = this.source + '=' + this.target;
				break;
			case 'network':
				scalar = this.source;
				break;
		}
		return ComposeDocument.quoted(scalar);
	}

	private validPort(value: string): boolean {
		const parts = value.split('-');
		if (parts.length < 1 || parts.length > 2) return false;
		const numbers = parts.map(swiftInt);
		if (!numbers.every((number) => number !== undefined && number >= 1 && number <= 65535))
			return false;
		return parts.length === 1 || numbers[0]! <= numbers[1]!;
	}
}
