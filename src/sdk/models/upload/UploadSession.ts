/** Port of Models/Upload/UploadSession.swift. */
import type { ISODateString } from '../base/date';

export type UploadKind = 'image' | 'volume-backup' | 'build-workspace';

export const UploadKind = {
	image: 'image',
	volumeBackup: 'volume-backup',
	buildWorkspace: 'build-workspace'
} as const satisfies Record<string, UploadKind>;

export interface UploadSession {
	id: string;
	kind: UploadKind;
	filename: string;
	size: number;
	chunkSize: number;
	totalChunks: number;
	receivedChunks: number[];
	complete: boolean;
	createdAt: ISODateString;
}

export interface CreateUploadSession {
	filename: string;
	size: number;
}

export interface UploadProgress {
	bytesDone: number;
	totalBytes: number;
}
