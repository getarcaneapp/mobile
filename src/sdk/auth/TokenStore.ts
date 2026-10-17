import type { ISODateString } from '../models/base/date';

export interface TokenPair {
	accessToken: string;
	refreshToken: string;
	expiresAt: ISODateString;
}

export const TokenPair = {
	equals(a: TokenPair | undefined, b: TokenPair | undefined): boolean {
		if (a === undefined || b === undefined) return a === b;
		return (
			a.accessToken === b.accessToken &&
			a.refreshToken === b.refreshToken &&
			a.expiresAt === b.expiresAt
		);
	}
} as const;

export interface TokenStore {
	loadTokens(): Promise<TokenPair | undefined>;
	saveTokens(tokens: TokenPair): Promise<void>;
	clearTokens(): Promise<void>;
}

export class InMemoryTokenStore implements TokenStore {
	private tokens: TokenPair | undefined;

	constructor(tokens?: TokenPair) {
		this.tokens = tokens;
	}

	async loadTokens(): Promise<TokenPair | undefined> {
		return this.tokens;
	}

	async saveTokens(tokens: TokenPair): Promise<void> {
		this.tokens = tokens;
	}

	async clearTokens(): Promise<void> {
		this.tokens = undefined;
	}
}
