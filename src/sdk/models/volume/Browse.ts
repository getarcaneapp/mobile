import type { ISODateString } from '../base/date';

export interface FileEntry {
	name: string;
	path: string;
	isDirectory: boolean;
	size: number;
	modTime: ISODateString;
	mode: string;
	isSymlink: boolean;
	linkTarget?: string;
}

export const FileEntry = {
	make(init: Omit<FileEntry, 'isSymlink'> & { isSymlink?: boolean }): FileEntry {
		return { ...init, isSymlink: init.isSymlink ?? false };
	}
} as const;

export interface FileMetadata {
	name: string;
	path: string;
	isDirectory: boolean;
	size: number;
	modTime: ISODateString;
	mode: string;
	isSymlink: boolean;
	linkTarget?: string;
	mimeType: string;
	isText: boolean;
	isBinary: boolean;
}

export const FileMetadata = {
	make(init: Omit<FileMetadata, 'isSymlink'> & { isSymlink?: boolean }): FileMetadata {
		return { ...init, isSymlink: init.isSymlink ?? false };
	}
} as const;

export interface FileContent {
	content: string;
	mimeType: string;
}
