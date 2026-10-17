/** Port of Models/Image/ImageDetail.swift. */
import type { JSONValue } from '../../types/json';

/** The `config` block on an `ImageDetailSummary`. */
export interface ImageDetailConfig {
	exposedPorts?: Record<string, JSONValue>;
	env?: string[];
	cmd?: string[];
	entrypoint?: string[];
	user?: string;
	volumes?: Record<string, JSONValue>;
	workingDir?: string;
	argsEscaped?: boolean;
	labels?: Record<string, string>;
}

/** The `graphDriver` block on an `ImageDetailSummary`. */
export interface ImageDetailGraphDriver {
	data?: JSONValue;
	name: string;
}

export const ImageDetailGraphDriver = {
	make(init: Partial<ImageDetailGraphDriver> = {}): ImageDetailGraphDriver {
		return { ...init, name: init.name ?? '' };
	}
} as const;

/** The `rootFs` block on an `ImageDetailSummary`. */
export interface ImageDetailRootFs {
	type: string;
	layers: string[];
}

export const ImageDetailRootFs = {
	make(init: Partial<ImageDetailRootFs> = {}): ImageDetailRootFs {
		return { type: init.type ?? '', layers: init.layers ?? [] };
	}
} as const;

/** The `metadata` block on an `ImageDetailSummary`. */
export interface ImageDetailMetadata {
	lastTagTime: string;
}

export const ImageDetailMetadata = {
	make(init: Partial<ImageDetailMetadata> = {}): ImageDetailMetadata {
		return { lastTagTime: init.lastTagTime ?? '' };
	}
} as const;

/** The `descriptor` block on an `ImageDetailSummary`. */
export interface ImageDetailDescriptor {
	mediaType: string;
	digest: string;
	size: number;
}

export const ImageDetailDescriptor = {
	make(init: Partial<ImageDetailDescriptor> = {}): ImageDetailDescriptor {
		return { mediaType: init.mediaType ?? '', digest: init.digest ?? '', size: init.size ?? 0 };
	}
} as const;

/** Detailed information about a single image (the `inspect` response shape). */
export interface ImageDetailSummary {
	id: string;
	repoTags: string[];
	repoDigests: string[];
	comment: string;
	created: string;
	author: string;
	dockerVersion?: string;
	config: ImageDetailConfig;
	architecture: string;
	os: string;
	size: number;
	graphDriver: ImageDetailGraphDriver;
	rootFs: ImageDetailRootFs;
	metadata: ImageDetailMetadata;
	descriptor: ImageDetailDescriptor;
}

export const ImageDetailSummary = {
	make(init: Partial<ImageDetailSummary> = {}): ImageDetailSummary {
		return {
			...init,
			id: init.id ?? '',
			repoTags: init.repoTags ?? [],
			repoDigests: init.repoDigests ?? [],
			comment: init.comment ?? '',
			created: init.created ?? '',
			author: init.author ?? '',
			config: init.config ?? {},
			architecture: init.architecture ?? '',
			os: init.os ?? '',
			size: init.size ?? 0,
			graphDriver: init.graphDriver ?? ImageDetailGraphDriver.make(),
			rootFs: init.rootFs ?? ImageDetailRootFs.make(),
			metadata: init.metadata ?? ImageDetailMetadata.make(),
			descriptor: init.descriptor ?? ImageDetailDescriptor.make()
		};
	}
} as const;
