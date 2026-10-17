import type { ISODateString } from '../base/date';

export interface APIKey {
	id: string;
	name: string;
	description?: string;
	keyPrefix: string;
	userId?: string;
	isStatic: boolean;
	expiresAt?: ISODateString;
	lastUsedAt?: ISODateString;
	createdAt: ISODateString;
	updatedAt?: ISODateString;
}

export const APIKey = {
	make(init: Omit<APIKey, 'isStatic'> & { isStatic?: boolean }): APIKey {
		return { ...init, isStatic: init.isStatic ?? false };
	}
} as const;

export interface APIKeyCreated {
	id: string;
	name: string;
	description?: string;
	keyPrefix: string;
	userId?: string;
	isStatic: boolean;
	expiresAt?: ISODateString;
	lastUsedAt?: ISODateString;
	createdAt: ISODateString;
	updatedAt?: ISODateString;
	key: string;
}

export const APIKeyCreated = {
	make(init: Omit<APIKeyCreated, 'isStatic'> & { isStatic?: boolean }): APIKeyCreated {
		return { ...init, isStatic: init.isStatic ?? false };
	}
} as const;

export interface CreateAPIKey {
	name: string;
	description?: string;
	expiresAt?: ISODateString;
}

export interface UpdateAPIKey {
	name?: string;
	description?: string;
	expiresAt?: ISODateString;
}
