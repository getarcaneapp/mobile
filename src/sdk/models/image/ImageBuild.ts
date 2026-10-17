import type { ISODateString } from '../base/date';

export interface ImageBuildRequest {
	contextDir: string;
	dockerfile?: string;
	dockerfileInline?: string;
	tags?: string[];
	target?: string;
	buildArgs?: Record<string, string>;
	labels?: Record<string, string>;
	cacheFrom?: string[];
	cacheTo?: string[];
	noCache?: boolean;
	pull?: boolean;
	network?: string;
	isolation?: string;
	shmSize?: number;
	ulimits?: Record<string, string>;
	entitlements?: string[];
	privileged?: boolean;
	extraHosts?: string[];
	platforms?: string[];
	push?: boolean;
	load?: boolean;
	provider?: string;
}

export interface ImageBuildResult {
	provider: string;
	tags?: string[];
	digest?: string;
}

export const ImageBuildResult = {
	make(init: Partial<ImageBuildResult> = {}): ImageBuildResult {
		return { ...init, provider: init.provider ?? '' };
	}
} as const;

export interface ImageBuildRecord {
	id: string;
	environmentId: string;
	userId?: string;
	username?: string;
	status: string;
	provider?: string;
	contextDir: string;
	dockerfile?: string;
	target?: string;
	tags?: string[];
	platforms?: string[];
	buildArgs?: Record<string, string>;
	labels?: Record<string, string>;
	cacheFrom?: string[];
	cacheTo?: string[];
	noCache: boolean;
	pull: boolean;
	network?: string;
	isolation?: string;
	shmSize?: number;
	ulimits?: Record<string, string>;
	entitlements?: string[];
	privileged: boolean;
	extraHosts?: string[];
	push: boolean;
	load: boolean;
	digest?: string;
	errorMessage?: string;
	output?: string;
	outputTruncated: boolean;
	completedAt?: ISODateString;
	durationMs?: number;
	createdAt: ISODateString;
}

export const ImageBuildRecord = {
	make(
		init: Partial<ImageBuildRecord> &
			Pick<ImageBuildRecord, 'id' | 'environmentId' | 'status' | 'contextDir' | 'createdAt'>
	): ImageBuildRecord {
		return {
			...init,
			noCache: init.noCache ?? false,
			pull: init.pull ?? false,
			privileged: init.privileged ?? false,
			push: init.push ?? false,
			load: init.load ?? false,
			outputTruncated: init.outputTruncated ?? false
		};
	}
} as const;
