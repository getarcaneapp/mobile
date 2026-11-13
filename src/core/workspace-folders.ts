export type WorkspaceTreeEntry = { relativePath: string; isDirectory: boolean };

export type WorkspaceFolderListing<T extends WorkspaceTreeEntry> = {
	path: string;
	files: readonly T[];
	truncated?: boolean;
};

export type WorkspacePathChange = {
	operation: string;
	relativePath: string;
	newName?: string;
	newParentPath?: string;
};

export function normalizeWorkspacePath(path: string): string {
	return path
		.replaceAll('\\', '/')
		.split('/')
		.filter((part) => part !== '' && part !== '.')
		.join('/');
}

export function workspaceParentPath(path: string): string {
	const normalized = normalizeWorkspacePath(path);
	const slash = normalized.lastIndexOf('/');
	return slash < 0 ? '' : normalized.slice(0, slash);
}

const joinPath = (parent: string, name: string) => (parent === '' ? name : `${parent}/${name}`);

const isWithin = (path: string, root: string) =>
	root === '' || path === root || path.startsWith(`${root}/`);

export function workspaceFolderChain(path: string): string[] {
	const parts = normalizeWorkspacePath(path).split('/').filter(Boolean);
	return parts.map((_, index) => parts.slice(0, index + 1).join('/'));
}

export function workspaceFolderDepth(path: string): number {
	const normalized = normalizeWorkspacePath(path);
	return normalized === '' ? 0 : normalized.split('/').length;
}

export function mergeWorkspaceFolder<T extends WorkspaceTreeEntry>(
	files: readonly T[],
	folder: string,
	children: readonly T[]
): T[] {
	const root = normalizeWorkspacePath(folder);
	const childDirectories = new Set(
		children.filter((child) => child.isDirectory).map((child) => child.relativePath)
	);
	const kept = files.filter((file) => {
		const path = file.relativePath;
		if (path === root || !isWithin(path, root)) return true;
		const rest = root === '' ? path : path.slice(root.length + 1);
		const slash = rest.indexOf('/');
		if (slash < 0) return false;
		return childDirectories.has(joinPath(root, rest.slice(0, slash)));
	});
	return [...kept, ...children];
}

export function assembleWorkspaceFolders<T extends WorkspaceTreeEntry>(
	listings: readonly WorkspaceFolderListing<T>[]
): { files: T[]; loaded: string[]; truncated: boolean } {
	const ordered = [...listings].sort(
		(lhs, rhs) => workspaceFolderDepth(lhs.path) - workspaceFolderDepth(rhs.path)
	);
	let files: T[] = [];
	const loaded: string[] = [];
	let truncated = false;
	for (const listing of ordered) {
		const path = normalizeWorkspacePath(listing.path);
		if (path !== '' && !files.some((file) => file.isDirectory && file.relativePath === path))
			continue;
		files = mergeWorkspaceFolder(files, path, listing.files);
		loaded.push(path);
		truncated = truncated || listing.truncated === true;
	}
	return { files, loaded, truncated };
}

function changeTarget(change: WorkspacePathChange, source: string): string {
	if (change.operation === 'rename' && change.newName)
		return joinPath(workspaceParentPath(source), change.newName);
	const name = source.slice(source.lastIndexOf('/') + 1);
	return joinPath(normalizeWorkspacePath(change.newParentPath ?? ''), name);
}

export function workspaceServerPath(
	changes: readonly WorkspacePathChange[],
	displayedPath: string
): string | null {
	let current = normalizeWorkspacePath(displayedPath);
	if (current === '') return '';
	for (const change of [...changes].reverse()) {
		const source = normalizeWorkspacePath(change.relativePath);
		const target =
			change.operation === 'rename' || change.operation === 'move'
				? changeTarget(change, source)
				: '';
		if (target !== '' && isWithin(current, target)) {
			current = `${source}${current.slice(target.length)}`;
		} else if (isWithin(current, source)) {
			return null;
		}
	}
	return current;
}
