import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

const maximumAgeMs = 24 * 60 * 60 * 1000;

function directory(): Directory {
	return new Directory(Paths.cache, 'Avatars');
}

async function fileFor(key: string): Promise<File> {
	const name = await digestStringAsync(CryptoDigestAlgorithm.SHA256, key);
	return new File(directory(), name);
}

export const AvatarDiskCache = {
	maximumAgeMs,

	async load(key: string): Promise<string | undefined> {
		try {
			const file = await fileFor(key);
			if (!file.exists) return undefined;
			const modified = file.modificationTime;
			if (modified === null || Date.now() - modified >= maximumAgeMs) return undefined;
			return file.uri;
		} catch {
			return undefined;
		}
	},

	async save(data: Uint8Array, key: string): Promise<string | undefined> {
		try {
			const dir = directory();
			if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
			const file = await fileFor(key);
			await file.write(data);
			return file.uri;
		} catch {
			return undefined;
		}
	},

	clear() {
		try {
			const dir = directory();
			if (dir.exists) dir.delete();
		} catch {}
	},

	diskBytes(): number {
		try {
			const dir = directory();
			if (!dir.exists) return 0;
			return dir
				.list()
				.reduce((total, entry) => total + (entry instanceof File ? entry.size : 0), 0);
		} catch {
			return 0;
		}
	}
} as const;
