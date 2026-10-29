export type APIGeneration = 'legacy' | 'v3';

export const APIGeneration = {
	legacy: 'legacy',
	v3: 'v3',
	knownCases: ['legacy', 'v3'] as const
} as const;

export class APIGenerationState {
	private value: APIGeneration | undefined;
	private pending: Promise<APIGeneration> | undefined;

	constructor(initial?: APIGeneration) {
		this.value = initial;
	}

	get current(): APIGeneration | undefined {
		return this.value;
	}

	record(value: APIGeneration): void {
		this.value = value;
	}

	reset(): void {
		this.value = undefined;
		this.pending = undefined;
	}

	resolve(probe: () => Promise<APIGeneration | undefined>): Promise<APIGeneration> {
		if (this.value !== undefined) return Promise.resolve(this.value);
		if (this.pending !== undefined) return this.pending;
		const pending = probe().then(
			(detected) => {
				if (this.pending === pending) this.pending = undefined;
				if (detected === undefined) return 'legacy' as const;
				this.record(detected);
				return detected;
			},
			() => {
				if (this.pending === pending) this.pending = undefined;
				return 'legacy' as const;
			}
		);
		this.pending = pending;
		return pending;
	}
}
