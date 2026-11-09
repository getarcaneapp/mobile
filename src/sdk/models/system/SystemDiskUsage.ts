import { D } from '../base/decoding';

export interface SystemDiskUsage {
	unusedImagesBytes: number;
	buildCacheBytes: number;
	unusedVolumesBytes: number;
	stoppedContainersBytes: number;
}

export const SystemDiskUsage = {
	decode(this: void, raw: unknown): SystemDiskUsage {
		const o = D.object(raw, 'SystemDiskUsage');
		return {
			unusedImagesBytes: D.optNumber(o, 'unusedImagesBytes') ?? 0,
			buildCacheBytes: D.optNumber(o, 'buildCacheBytes') ?? 0,
			unusedVolumesBytes: D.optNumber(o, 'unusedVolumesBytes') ?? 0,
			stoppedContainersBytes: D.optNumber(o, 'stoppedContainersBytes') ?? 0
		};
	},

	totalBytes(this: void, usage: SystemDiskUsage): number {
		return (
			usage.unusedImagesBytes +
			usage.buildCacheBytes +
			usage.unusedVolumesBytes +
			usage.stoppedContainersBytes
		);
	}
} as const;
