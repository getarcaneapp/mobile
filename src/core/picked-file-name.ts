import type { File } from 'expo-file-system';

const extensionByType: Record<string, string> = {
	'application/x-tar': '.tar',
	'application/tar': '.tar',
	'application/gzip': '.tar.gz',
	'application/x-gzip': '.tar.gz',
	'application/x-compressed-tar': '.tar.gz',
	'application/x-xz': '.tar.xz',
	'application/x-xz-compressed-tar': '.tar.xz',
	'application/zip': '.zip',
	'application/json': '.json',
	'application/x-yaml': '.yaml',
	'application/yaml': '.yaml',
	'text/yaml': '.yaml',
	'text/plain': '.txt'
};

export function pickedFileName(file: Pick<File, 'name' | 'uri' | 'type'>): string {
	const name = file.name;
	if (!file.uri.startsWith('content://') || /\.[A-Za-z0-9]+$/.test(name)) return name;
	const base = name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
	return `${base}${extensionByType[file.type?.toLowerCase() ?? ''] ?? ''}`;
}
