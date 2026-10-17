export class ComposeDocumentError extends Error {
	readonly kind: 'invalid' | 'unsupported' | 'missing';
	private constructor(kind: 'invalid' | 'unsupported' | 'missing', message: string) {
		super(message);
		this.kind = kind;
	}
	static invalid(message: string) {
		return new ComposeDocumentError('invalid', message);
	}
	static get unsupported() {
		return new ComposeDocumentError(
			'unsupported',
			'This YAML structure must be edited in the YAML editor.'
		);
	}
	static get missing() {
		return new ComposeDocumentError(
			'missing',
			'This field no longer exists. Reopen the editor and try again.'
		);
	}
}

export class ComposeFormError extends Error {
	readonly kind: 'duplicate' | 'changed' | 'invalid';
	private constructor(kind: 'duplicate' | 'changed' | 'invalid', message: string) {
		super(message);
		this.kind = kind;
	}
	static get duplicate() {
		return new ComposeFormError('duplicate', 'That name already exists.');
	}
	static get changed() {
		return new ComposeFormError('changed', 'This entry changed. Reopen it before editing.');
	}
	static invalid(message: string) {
		return new ComposeFormError('invalid', message);
	}
}

export function composeErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
