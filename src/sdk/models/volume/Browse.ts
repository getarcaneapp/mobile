/** Port of Models/Volume/Browse.swift. */
import type { ISODateString } from '../base/date';

/** FileEntry represents a single file or directory inside a volume. */
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

/** FileMetadata extends `FileEntry` with MIME and text/binary hints. */
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

/** FileContent is the response payload returned by `GET volumes/{name}/browse/content`. */
export interface FileContent {
	/** Base64-encoded file bytes. */
	content: string;
	mimeType: string;
}
