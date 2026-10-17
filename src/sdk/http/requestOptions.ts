export class ArcaneRequestOptionsValidationError extends Error {
	readonly kind = 'invalidActivityBatchID' as const;
	constructor() {
		super('Invalid activity batch ID');
		this.name = 'ArcaneRequestOptions.ValidationError';
	}
}

function isValidActivityBatchID(value: string): boolean {
	return /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

export class ArcaneRequestOptions {
	readonly activityBatchID: string | undefined;
	readonly stepUpToken: string | undefined;

	private constructor(activityBatchID?: string, stepUpToken?: string) {
		this.activityBatchID = activityBatchID;
		this.stepUpToken = stepUpToken;
	}

	static none(): ArcaneRequestOptions {
		return new ArcaneRequestOptions();
	}

	static withActivityBatchID(activityBatchID: string): ArcaneRequestOptions {
		if (!isValidActivityBatchID(activityBatchID)) {
			throw new ArcaneRequestOptionsValidationError();
		}
		return new ArcaneRequestOptions(activityBatchID);
	}

	static withStepUpToken(stepUpToken: string): ArcaneRequestOptions {
		return new ArcaneRequestOptions(undefined, stepUpToken);
	}

	equals(other: ArcaneRequestOptions): boolean {
		return this.activityBatchID === other.activityBatchID && this.stepUpToken === other.stepUpToken;
	}
}
