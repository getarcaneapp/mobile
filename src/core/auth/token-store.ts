import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { storage } from '@/core/storage';
import { TokenPair, type TokenStore } from '@/sdk/auth/TokenStore';
import { CancellationError } from '@/sdk/errors/ArcaneError';

const service = 'com.arcane.mobile.tokens';
const credentialOriginKey = 'arcane.credentialOrigin';

export const CredentialBinding = {
	get origin(): string | undefined {
		return storage.string(credentialOriginKey);
	},
	bind(origin: string) {
		storage.set(credentialOriginKey, origin);
	},
	unbind(matching?: string) {
		if (matching !== undefined && CredentialBinding.origin !== matching) return;
		storage.remove(credentialOriginKey);
	}
} as const;

export class CredentialLease {
	private active = true;
	private allowsClear = true;

	get isActive() {
		return this.active;
	}
	get canClear() {
		return this.allowsClear;
	}

	retire(allowClear = false) {
		this.active = false;
		this.allowsClear = allowClear;
	}

	whileActive(operation: () => void) {
		if (!this.active) throw new CancellationError();
		operation();
	}
}

export class CredentialPersistenceCoordinator {
	private tail: Promise<unknown> = Promise.resolve();

	save(
		tokens: TokenPair,
		store: TokenStore,
		lease: CredentialLease,
		bind: () => void
	): Promise<void> {
		const previous = this.tail;
		const task = (async () => {
			await previous.catch(() => undefined);
			if (!lease.isActive) throw new CancellationError();
			await store.saveTokens(tokens);
			if (!lease.isActive) {
				if (TokenPair.equals(await store.loadTokens(), tokens)) await store.clearTokens();
				throw new CancellationError();
			}
			try {
				lease.whileActive(bind);
			} catch (error) {
				if (TokenPair.equals(await store.loadTokens(), tokens)) await store.clearTokens();
				throw error;
			}
		})();
		this.tail = task;
		return task;
	}

	clear(stores: TokenStore[], lease: CredentialLease, unbind: () => void): Promise<void> {
		const previous = this.tail;
		const task = (async () => {
			await previous.catch(() => undefined);
			if (!lease.canClear) throw new CancellationError();
			let firstError: unknown;
			for (const store of stores) {
				if (!lease.canClear) throw new CancellationError();
				try {
					await store.clearTokens();
				} catch (error) {
					firstError ??= error;
				}
			}
			if (lease.canClear) unbind();
			if (firstError !== undefined) throw firstError;
		})();
		this.tail = task;
		return task;
	}
}

const serviceKeys = new Map<string, Promise<string>>();

function originServiceKey(origin: string): Promise<string> {
	let key = serviceKeys.get(origin);
	if (!key) {
		key = digestStringAsync(CryptoDigestAlgorithm.SHA256, origin).then(
			(digest) => `${service}.${digest}`
		);
		serviceKeys.set(origin, key);
	}
	return key;
}

const secureOptions: SecureStore.SecureStoreOptions = {
	keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK
};

export class SecureStoreTokenStore implements TokenStore {
	constructor(private readonly origin: string) {}

	async loadTokens(): Promise<TokenPair | undefined> {
		const raw = await SecureStore.getItemAsync(await originServiceKey(this.origin), secureOptions);
		if (raw === null) return undefined;
		const parsed = JSON.parse(raw) as Partial<TokenPair>;
		if (
			typeof parsed.accessToken !== 'string' ||
			typeof parsed.refreshToken !== 'string' ||
			typeof parsed.expiresAt !== 'string'
		) {
			return undefined;
		}
		return {
			accessToken: parsed.accessToken,
			refreshToken: parsed.refreshToken,
			expiresAt: parsed.expiresAt
		};
	}

	async saveTokens(tokens: TokenPair): Promise<void> {
		await SecureStore.setItemAsync(
			await originServiceKey(this.origin),
			JSON.stringify(tokens),
			secureOptions
		);
	}

	async clearTokens(): Promise<void> {
		await SecureStore.deleteItemAsync(await originServiceKey(this.origin), secureOptions);
	}
}

export class OriginTokenStore implements TokenStore {
	private readonly originStore: TokenStore;

	constructor(
		private readonly origin: string,
		private readonly lease: CredentialLease,
		private readonly persistence: CredentialPersistenceCoordinator,
		originStore?: TokenStore
	) {
		this.originStore = originStore ?? new SecureStoreTokenStore(origin);
	}

	async loadTokens(): Promise<TokenPair | undefined> {
		if (!(this.lease.isActive || this.lease.canClear) || CredentialBinding.origin !== this.origin)
			return undefined;
		const tokens = await this.originStore.loadTokens();
		if (tokens === undefined) return undefined;
		if (!(this.lease.isActive || this.lease.canClear)) throw new CancellationError();
		return tokens;
	}

	saveTokens(tokens: TokenPair): Promise<void> {
		return this.persistence.save(tokens, this.originStore, this.lease, () =>
			CredentialBinding.bind(this.origin)
		);
	}

	clearTokens(): Promise<void> {
		return this.persistence.clear([this.originStore], this.lease, () =>
			CredentialBinding.unbind(this.origin)
		);
	}
}
