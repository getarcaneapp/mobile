import { randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import {
	ConnectionHeaderValidationError,
	ConnectionHeaders,
	ConnectionHeadersRecord,
	type ConnectionHeader
} from '@/core/connection-profiles/connection-headers';
import {
	credentialCloud,
	headersCloud,
	passwordManager,
	profileCloud,
	type ProfileCloudKind
} from '@/core/connection-profiles/connection-profile-cloud';
import {
	ConnectionCredentialRecord,
	ConnectionCredentialValidationError,
	ConnectionProfilePayload,
	ConnectionProfileSync,
	ConnectionProfileValidationError,
	decodeConnectionProfilePayload,
	type ConnectionProfile,
	type SavedConnectionCredential
} from '@/core/connection-profiles/connection-profile-sync';
import { storage } from '@/core/storage';

export type {
	ConnectionProfile,
	SavedConnectionCredential
} from '@/core/connection-profiles/connection-profile-sync';

const payloadKey = 'arcane.connectionProfiles.v1';
const credentialIndexKey = 'arcane.connectionCredentialIDs.v1';
const credentialCloudIndexKey = 'arcane.connectionCredentialCloudIDs.v1';
const credentialService = 'com.getarcaneapp.ios.mobile.connection-credential.v1';
const credentialOptions: SecureStore.SecureStoreOptions = {
	keychainAccessible: SecureStore.WHEN_UNLOCKED
};
const headersIndexKey = 'arcane.connectionHeaderIDs.v1';
const headersCloudIndexKey = 'arcane.connectionHeaderCloudIDs.v1';
const headersService = 'com.getarcaneapp.ios.mobile.connection-headers.v1';
const headersOptions: SecureStore.SecureStoreOptions = {
	keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK
};

export type ConnectionProfileSyncState = ProfileCloudKind | 'unavailable';

export const syncStateDescription: Record<ConnectionProfileSyncState, string> = {
	iCloudKeychain: 'Syncs with iCloud Keychain',
	googleBackup: 'Backed up to your Google account',
	deviceOnly: 'Stored on this device',
	unavailable:
		Platform.OS === 'ios'
			? 'iCloud Keychain is temporarily unavailable'
			: 'Profile storage is temporarily unavailable'
};

const describeError = (error: unknown): string =>
	typeof error === 'string'
		? error
		: error instanceof Error
			? error.toString()
			: JSON.stringify(error);

const log = (message: string, error?: unknown) => {
	if (__DEV__)
		console.log(
			`[ArcaneCloudSync] ${message}`,
			...(error === undefined ? [] : [describeError(error)])
		);
};

const profilePersistence = {
	load(): ConnectionProfilePayload {
		return decodeConnectionProfilePayload(storage.json<unknown>(payloadKey));
	},
	save(payload: ConnectionProfilePayload) {
		storage.setJSON(payloadKey, payload);
	}
};

const idSet = (key: string) => {
	const ids = storage.json<unknown>(key);
	return new Set(
		Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
	);
};

const writeIDSet = (key: string, ids: Set<string>) => {
	if (ids.size === 0) storage.remove(key);
	else storage.setJSON(key, [...ids].sort());
};

const updateIDSet = (key: string, id: string, present: boolean) => {
	const ids = idSet(key);
	if (ids.has(id) === present) return;
	if (present) ids.add(id);
	else ids.delete(id);
	writeIDSet(key, ids);
};

const credentialPersistence = {
	key(profileID: string) {
		return `${credentialService}.${profileID}`;
	},
	profileIDs: () => idSet(credentialIndexKey),
	load(profileID: string): ConnectionCredentialRecord | undefined {
		const raw = SecureStore.getItem(this.key(profileID), credentialOptions);
		if (raw === null) return undefined;
		const record = ConnectionCredentialRecord.decode(JSON.parse(raw));
		if (record.profileID !== profileID)
			throw new ConnectionCredentialValidationError('persistenceFailed');
		return record;
	},
	save(record: ConnectionCredentialRecord) {
		SecureStore.setItem(this.key(record.profileID), JSON.stringify(record), credentialOptions);
		updateIDSet(credentialIndexKey, record.profileID, true);
	},
	delete(profileID: string) {
		updateIDSet(credentialIndexKey, profileID, false);
		void SecureStore.deleteItemAsync(this.key(profileID), credentialOptions).catch(
			(error: unknown) => {
				log('sign-in delete failed', error);
				updateIDSet(credentialIndexKey, profileID, true);
				const store = useConnectionProfileStore.getState();
				if (
					store.profiles.some((profile) => profile.id === profileID) &&
					!store.credentialProfileIDs.has(profileID)
				)
					useConnectionProfileStore.setState({
						credentialProfileIDs: new Set([...store.credentialProfileIDs, profileID])
					});
			}
		);
	}
};

const headersPersistence = {
	key(profileID: string) {
		return `${headersService}.${profileID}`;
	},
	profileIDs: () => idSet(headersIndexKey),
	read(profileID: string): string | undefined {
		return SecureStore.getItem(this.key(profileID), headersOptions) ?? undefined;
	},
	decode(raw: string, profileID: string): ConnectionHeadersRecord | undefined {
		try {
			const record = ConnectionHeadersRecord.decode(JSON.parse(raw));
			return record.profileID === profileID ? record : undefined;
		} catch {
			return undefined;
		}
	},
	load(profileID: string): ConnectionHeadersRecord | undefined {
		const raw = this.read(profileID);
		return raw === undefined ? undefined : this.decode(raw, profileID);
	},
	save(record: ConnectionHeadersRecord) {
		SecureStore.setItem(this.key(record.profileID), JSON.stringify(record), headersOptions);
		updateIDSet(headersIndexKey, record.profileID, true);
	},
	delete(profileID: string) {
		updateIDSet(headersIndexKey, profileID, false);
		void SecureStore.deleteItemAsync(this.key(profileID), headersOptions).catch(
			(error: unknown) => {
				log('headers delete failed', error);
				updateIDSet(headersIndexKey, profileID, true);
				useConnectionProfileStore.getState().loadLocal();
			}
		);
	}
};

type SyncedSecret<Secret extends { profileID: string }> = {
	cloud: {
		isSupported: boolean;
		profileIDs: () => Promise<Set<string>>;
		load: (profileID: string) => Promise<Secret | undefined>;
		save: (record: Secret) => Promise<void>;
		delete: (profileID: string) => Promise<void>;
	};
	cloudIndexKey: string;
	pending: Map<string, number>;
	loadLocal: (profileID: string) => Secret | undefined;
	saveLocal: (record: Secret) => void;
	deleteLocal: (profileID: string) => void;
	isValid: (record: Secret, profile: ConnectionProfile) => boolean;
	same: (local: Secret | undefined, remote: Secret) => boolean;
};

const beginChange = (pending: Map<string, number>, profileID: string) => {
	pending.set(profileID, (pending.get(profileID) ?? 0) + 1);
};

const endChange = (pending: Map<string, number>, profileID: string) => {
	const remaining = (pending.get(profileID) ?? 1) - 1;
	if (remaining > 0) pending.set(profileID, remaining);
	else pending.delete(profileID);
};

const sameCredential = (a: ConnectionCredentialRecord | undefined, b: ConnectionCredentialRecord) =>
	a !== undefined &&
	a.serverURL === b.serverURL &&
	a.username === b.username &&
	a.password === b.password;

type ConnectionProfileStoreState = {
	profiles: ConnectionProfile[];
	credentialProfileIDs: ReadonlySet<string>;
	headerProfileIDs: ReadonlySet<string>;
	headersRevision: number;
	syncState: ConnectionProfileSyncState;

	profile: (matching: string) => ConnectionProfile | undefined;
	hasSavedCredential: (profile: ConnectionProfile) => boolean;
	savedCredential: (profile: ConnectionProfile) => SavedConnectionCredential | undefined;
	saveConnectedServer: (
		serverURL: string,
		credential?: SavedConnectionCredential
	) => ConnectionProfile;
	save: (name: string, serverURL: string) => ConnectionProfile;
	saveConnectionProfile: (
		profile: ConnectionProfile | undefined,
		name: string,
		serverURL: string,
		credential: SavedConnectionCredential | undefined,
		headers?: readonly ConnectionHeader[]
	) => ConnectionProfile;
	update: (profile: ConnectionProfile, name: string, serverURL: string) => ConnectionProfile;
	delete: (profile: ConnectionProfile) => void;
	saveCredential: (profile: ConnectionProfile, username: string, password: string) => void;
	removeCredential: (profile: ConnectionProfile) => void;
	savedHeaders: (profile: ConnectionProfile) => readonly ConnectionHeader[];
	headersFor: (serverURL: string) => Record<string, string>;
	saveHeaders: (profile: ConnectionProfile, headers: readonly ConnectionHeader[]) => void;
	removeHeaders: (profile: ConnectionProfile) => void;
	pickPasswordManagerCredential: (
		profile: ConnectionProfile
	) => Promise<SavedConnectionCredential | undefined>;
	refreshFromCloud: () => Promise<void>;
	loadLocal: () => void;
};

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
	a.size === b.size && [...a].every((x) => b.has(x));

export const useConnectionProfileStore = create<ConnectionProfileStoreState>((set, get) => {
	let payload: ConnectionProfilePayload = ConnectionProfilePayload.empty;
	let cloudQueue: Promise<void> = Promise.resolve();
	const pendingCredentialChanges = new Map<string, number>();
	const pendingHeaderChanges = new Map<string, number>();
	let headersByProfileID = new Map<string, readonly ConnectionHeader[]>();

	const beginCredentialChange = (profileID: string) =>
		beginChange(pendingCredentialChanges, profileID);
	const endCredentialChange = (profileID: string) => endChange(pendingCredentialChanges, profileID);

	const publishHeaders = (next: Map<string, readonly ConnectionHeader[]>) => {
		const changed =
			next.size !== headersByProfileID.size ||
			[...next].some(([id, headers]) => {
				const current = headersByProfileID.get(id);
				return !current || !ConnectionHeaders.equals(current, headers);
			});
		headersByProfileID = next;
		if (changed)
			set((s) => ({
				headerProfileIDs: new Set(next.keys()),
				headersRevision: s.headersRevision + 1
			}));
	};

	const refreshHeaders = () => {
		const stored = headersPersistence.profileIDs();
		const next = new Map<string, readonly ConnectionHeader[]>();
		for (const profile of get().profiles) {
			if (!stored.has(profile.id)) continue;
			let raw: string | undefined;
			try {
				raw = headersPersistence.read(profile.id);
			} catch {
				const cached = headersByProfileID.get(profile.id);
				if (cached) next.set(profile.id, cached);
				continue;
			}
			const record = raw === undefined ? undefined : headersPersistence.decode(raw, profile.id);
			const headers = record ? ConnectionHeadersRecord.headers(record, profile) : undefined;
			if (!headers) {
				headersPersistence.delete(profile.id);
				continue;
			}
			next.set(profile.id, headers);
		}
		for (const id of stored)
			if (!get().profiles.some((p) => p.id === id)) headersPersistence.delete(id);
		publishHeaders(next);
	};

	const enqueue = (label: string, operation: () => Promise<void>): Promise<void> => {
		cloudQueue = cloudQueue.then(operation).catch((error: unknown) => {
			log(`${label} failed`, error);
			set({ syncState: Platform.OS === 'ios' ? 'unavailable' : 'deviceOnly' });
		});
		return cloudQueue;
	};

	const publishProfiles = () => {
		const next = ConnectionProfileSync.activeProfiles(payload);
		const current = get()?.profiles ?? [];
		const changed =
			next.length !== current.length ||
			next.some((p, i) => {
				const c = current[i];
				return (
					!c ||
					c.id !== p.id ||
					c.name !== p.name ||
					c.serverURL !== p.serverURL ||
					c.modifiedAt !== p.modifiedAt
				);
			});
		if (changed) set({ profiles: next });
	};

	const refreshCredentialProfileIDs = () => {
		const stored = credentialPersistence.profileIDs();
		const valid = new Set<string>();
		for (const profile of get().profiles) {
			if (!stored.has(profile.id)) continue;
			let record: ConnectionCredentialRecord | undefined;
			try {
				record = credentialPersistence.load(profile.id);
			} catch {
				record = undefined;
			}
			if (!record || !ConnectionCredentialRecord.credential(record, profile)) {
				credentialPersistence.delete(profile.id);
				continue;
			}
			valid.add(profile.id);
		}
		for (const id of stored)
			if (!get().profiles.some((p) => p.id === id)) credentialPersistence.delete(id);
		if (!sameSet(valid, get().credentialProfileIDs)) set({ credentialProfileIDs: valid });
	};

	const loadLocal = () => {
		try {
			const stored = profilePersistence.load();
			payload = ConnectionProfileSync.merge(payload, stored);
			if (!ConnectionProfilePayload.equals(payload, stored)) profilePersistence.save(payload);
			publishProfiles();
			refreshCredentialProfileIDs();
			refreshHeaders();
		} catch {
			set({ syncState: 'unavailable' });
		}
	};

	const syncSecrets = async <Secret extends { profileID: string }>(
		secret: SyncedSecret<Secret>
	) => {
		if (!secret.cloud.isSupported) return;
		const cloudIDs = await secret.cloud.profileIDs();
		const confirmed = idSet(secret.cloudIndexKey);
		for (const profile of get().profiles) {
			if (secret.pending.has(profile.id)) continue;
			let local: Secret | undefined;
			try {
				local = secret.loadLocal(profile.id);
			} catch {
				local = undefined;
			}
			if (cloudIDs.has(profile.id)) {
				const remote = await secret.cloud.load(profile.id).catch(() => undefined);
				if (!remote || !secret.isValid(remote, profile)) {
					await secret.cloud.delete(profile.id);
					if (local) secret.deleteLocal(profile.id);
					confirmed.delete(profile.id);
					continue;
				}
				if (!secret.same(local, remote)) secret.saveLocal(remote);
				confirmed.add(profile.id);
			} else if (local) {
				if (confirmed.has(profile.id)) {
					secret.deleteLocal(profile.id);
					confirmed.delete(profile.id);
				} else {
					await secret.cloud.save(local);
					confirmed.add(profile.id);
				}
			}
		}
		for (const id of confirmed) if (!get().profiles.some((p) => p.id === id)) confirmed.delete(id);
		writeIDSet(secret.cloudIndexKey, confirmed);
	};

	const syncCredentials = async () => {
		await syncSecrets<ConnectionCredentialRecord>({
			cloud: credentialCloud,
			cloudIndexKey: credentialCloudIndexKey,
			pending: pendingCredentialChanges,
			loadLocal: (profileID) => credentialPersistence.load(profileID),
			saveLocal: (record) => credentialPersistence.save(record),
			deleteLocal: (profileID) => credentialPersistence.delete(profileID),
			isValid: (record, profile) =>
				ConnectionCredentialRecord.credential(record, profile) !== undefined,
			same: sameCredential
		});
		refreshCredentialProfileIDs();
	};

	const syncHeaders = async () => {
		await syncSecrets<ConnectionHeadersRecord>({
			cloud: headersCloud,
			cloudIndexKey: headersCloudIndexKey,
			pending: pendingHeaderChanges,
			loadLocal: (profileID) => headersPersistence.load(profileID),
			saveLocal: (record) => headersPersistence.save(record),
			deleteLocal: (profileID) => headersPersistence.delete(profileID),
			isValid: (record, profile) => ConnectionHeadersRecord.headers(record, profile) !== undefined,
			same: (local, remote) => ConnectionHeadersRecord.equals(local, remote)
		});
		refreshHeaders();
	};

	const syncWithCloud = async () => {
		const kind = await profileCloud.kind();
		const remote = await profileCloud.load();
		const merged = ConnectionProfileSync.merge(payload, remote);
		const remoteInMergeOrder = {
			version: remote.version,
			records: [...remote.records].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
		};
		if (!ConnectionProfilePayload.equals(merged, remoteInMergeOrder)) {
			await profileCloud.save(merged);
			log(`uploaded ${merged.records.length} profile record(s) (${kind})`);
		}
		const local = ConnectionProfileSync.merge(payload, merged);
		if (!ConnectionProfilePayload.equals(local, profilePersistence.load()))
			profilePersistence.save(local);
		payload = local;
		publishProfiles();
		await syncCredentials();
		await syncHeaders();
		log(`synced ${get().profiles.length} profile(s) (${kind})`);
		set({ syncState: kind });
	};

	const commit = (candidate: ConnectionProfilePayload) => {
		const normalized = ConnectionProfileSync.merge(candidate, ConnectionProfilePayload.empty);
		try {
			profilePersistence.save(normalized);
		} catch {
			set({ syncState: 'unavailable' });
			throw new ConnectionProfileValidationError('persistenceFailed');
		}
		payload = normalized;
		publishProfiles();
		void enqueue('profile sync', syncWithCloud);
	};

	const write = (
		profileID: string | undefined,
		name: string,
		serverURL: string
	): ConnectionProfile => {
		loadLocal();
		const normalized = ConnectionProfileSync.normalizedServerURL(serverURL);
		const profiles = get().profiles;
		const existingByURL = profiles.find((p) => p.serverURL === normalized);
		const id = profileID ?? existingByURL?.id ?? randomUUID().toUpperCase();
		if (
			!existingByURL &&
			profileID === undefined &&
			profiles.length >= ConnectionProfileSync.maximumActiveProfiles
		) {
			throw new ConnectionProfileValidationError('profileLimitReached');
		}
		const record = {
			id,
			name: ConnectionProfileSync.sanitizedName(name, normalized),
			serverURL: normalized,
			modifiedAt: Date.now(),
			revision: randomUUID().toUpperCase(),
			isDeleted: false
		};
		const index = payload.records.findIndex((r) => r.id === id);
		const records =
			index >= 0
				? payload.records.map((r, i) => (i === index ? record : r))
				: [...payload.records, record];
		commit({ ...payload, records });
		const saved =
			get().profiles.find((p) => p.id === id) ??
			get().profiles.find((p) => p.serverURL === normalized);
		if (!saved) throw new ConnectionProfileValidationError('persistenceFailed');
		return saved;
	};

	const storeCredentialLocally = (record: ConnectionCredentialRecord): boolean => {
		let existing: ConnectionCredentialRecord | undefined;
		try {
			existing = credentialPersistence.load(record.profileID);
		} catch {
			existing = undefined;
		}
		const changed = !sameCredential(existing, record);
		try {
			if (changed) credentialPersistence.save(record);
		} catch {
			set({ syncState: 'unavailable' });
			throw new ConnectionCredentialValidationError('persistenceFailed');
		}
		if (!get().credentialProfileIDs.has(record.profileID)) {
			set({ credentialProfileIDs: new Set([...get().credentialProfileIDs, record.profileID]) });
		}
		return changed;
	};

	const store: ConnectionProfileStoreState = {
		profiles: [],
		credentialProfileIDs: new Set(),
		headerProfileIDs: new Set(),
		headersRevision: 0,
		syncState: Platform.OS === 'ios' ? 'iCloudKeychain' : 'deviceOnly',

		profile: (matching) => {
			let normalized: string;
			try {
				normalized = ConnectionProfileSync.normalizedServerURL(matching);
			} catch {
				return undefined;
			}
			return get().profiles.find((p) => p.serverURL === normalized);
		},

		hasSavedCredential: (profile) => get().credentialProfileIDs.has(profile.id),

		savedCredential: (profile) => {
			const remove = (id: string) => {
				const next = new Set(get().credentialProfileIDs);
				next.delete(id);
				set({ credentialProfileIDs: next });
			};
			try {
				const record = credentialPersistence.load(profile.id);
				if (!record) {
					remove(profile.id);
					return undefined;
				}
				const credential = ConnectionCredentialRecord.credential(record, profile);
				if (!credential) {
					get().removeCredential(profile);
					return undefined;
				}
				if (!get().credentialProfileIDs.has(profile.id)) {
					set({ credentialProfileIDs: new Set([...get().credentialProfileIDs, profile.id]) });
				}
				return credential;
			} catch {
				set({ syncState: 'unavailable' });
				throw new ConnectionCredentialValidationError('persistenceFailed');
			}
		},

		saveConnectedServer: (serverURL, credential) => {
			const normalized = ConnectionProfileSync.normalizedServerURL(serverURL);
			const profile =
				get().profiles.find((p) => p.serverURL === normalized) ??
				get().save(ConnectionProfileSync.defaultName(normalized), normalized);
			if (credential) get().saveCredential(profile, credential.username, credential.password);
			return profile;
		},

		save: (name, serverURL) => write(undefined, name, serverURL),

		saveConnectionProfile: (profile, name, serverURL, credential, headers) => {
			const validHeaders = headers ? ConnectionHeaders.make(headers) : undefined;
			const saved = profile ? get().update(profile, name, serverURL) : get().save(name, serverURL);
			if (credential) get().saveCredential(saved, credential.username, credential.password);
			else if (get().hasSavedCredential(saved)) get().removeCredential(saved);
			if (validHeaders) get().saveHeaders(saved, validHeaders);
			return saved;
		},

		update: (profile, name, serverURL) => {
			const normalized = ConnectionProfileSync.normalizedServerURL(serverURL);
			if (normalized !== profile.serverURL) {
				get().removeCredential(profile);
				get().removeHeaders(profile);
			}
			return write(profile.id, name, serverURL);
		},

		delete: (profile) => {
			get().removeCredential(profile);
			get().removeHeaders(profile);
			loadLocal();
			const index = payload.records.findIndex((r) => r.id === profile.id);
			if (index < 0) return;
			commit({
				...payload,
				records: payload.records.map((r, i) =>
					i === index
						? {
								...r,
								modifiedAt: Date.now(),
								revision: randomUUID().toUpperCase(),
								isDeleted: true
							}
						: r
				)
			});
		},

		saveCredential: (profile, username, password) => {
			const record = ConnectionCredentialRecord.make(profile, username, password);
			const changed = storeCredentialLocally(record);
			if (credentialCloud.isSupported) {
				beginCredentialChange(record.profileID);
				void enqueue('sign-in upload', async () => {
					try {
						await credentialCloud.save(record);
						updateIDSet(credentialCloudIndexKey, record.profileID, true);
						set({ syncState: 'iCloudKeychain' });
					} finally {
						endCredentialChange(record.profileID);
					}
				});
			} else if (changed && passwordManager.isSupported) {
				void passwordManager
					.save(username, password)
					.then((saved) => log(`password manager save: ${saved}`))
					.catch((error: unknown) => log('password manager save failed', error));
			}
		},

		removeCredential: (profile) => {
			try {
				credentialPersistence.delete(profile.id);
			} catch {
				set({ syncState: 'unavailable' });
				throw new ConnectionCredentialValidationError('persistenceFailed');
			}
			const next = new Set(get().credentialProfileIDs);
			next.delete(profile.id);
			set({ credentialProfileIDs: next });
			if (credentialCloud.isSupported) {
				beginCredentialChange(profile.id);
				void enqueue('sign-in delete', async () => {
					try {
						await credentialCloud.delete(profile.id);
						updateIDSet(credentialCloudIndexKey, profile.id, false);
					} finally {
						endCredentialChange(profile.id);
					}
				});
			}
		},

		savedHeaders: (profile) => headersByProfileID.get(profile.id) ?? [],

		headersFor: (serverURL) => {
			const profile = get().profile(serverURL);
			return ConnectionHeaders.record(profile ? (headersByProfileID.get(profile.id) ?? []) : []);
		},

		saveHeaders: (profile, headers) => {
			const record = ConnectionHeadersRecord.make(profile, headers);
			if (record.headers.length === 0) {
				get().removeHeaders(profile);
				return;
			}
			const existing = headersByProfileID.get(profile.id);
			if (existing && ConnectionHeaders.equals(existing, record.headers)) return;
			try {
				headersPersistence.save(record);
			} catch {
				set({ syncState: 'unavailable' });
				throw new ConnectionHeaderValidationError('persistenceFailed');
			}
			publishHeaders(new Map(headersByProfileID).set(profile.id, record.headers));
			if (!headersCloud.isSupported) return;
			beginChange(pendingHeaderChanges, profile.id);
			void enqueue('headers upload', async () => {
				try {
					await headersCloud.save(record);
					updateIDSet(headersCloudIndexKey, profile.id, true);
					set({ syncState: 'iCloudKeychain' });
				} finally {
					endChange(pendingHeaderChanges, profile.id);
				}
			});
		},

		removeHeaders: (profile) => {
			if (
				!headersByProfileID.has(profile.id) &&
				!headersPersistence.profileIDs().has(profile.id) &&
				!idSet(headersCloudIndexKey).has(profile.id)
			)
				return;
			try {
				headersPersistence.delete(profile.id);
			} catch {
				set({ syncState: 'unavailable' });
				throw new ConnectionHeaderValidationError('persistenceFailed');
			}
			const next = new Map(headersByProfileID);
			next.delete(profile.id);
			publishHeaders(next);
			if (!headersCloud.isSupported) return;
			beginChange(pendingHeaderChanges, profile.id);
			void enqueue('headers delete', async () => {
				try {
					await headersCloud.delete(profile.id);
					updateIDSet(headersCloudIndexKey, profile.id, false);
				} finally {
					endChange(pendingHeaderChanges, profile.id);
				}
			});
		},

		pickPasswordManagerCredential: async (profile) => {
			if (!passwordManager.isSupported) return undefined;
			const picked = await passwordManager.pick().catch((error: unknown) => {
				log('password manager pick failed', error);
				return undefined;
			});
			if (!picked) return undefined;
			try {
				storeCredentialLocally(
					ConnectionCredentialRecord.make(profile, picked.username, picked.password)
				);
				return { username: picked.username, password: picked.password };
			} catch {
				return undefined;
			}
		},

		refreshFromCloud: () => enqueue('profile sync', syncWithCloud),
		loadLocal
	};
	return store;
});

useConnectionProfileStore.getState().loadLocal();
void useConnectionProfileStore.getState().refreshFromCloud();

{
	let wasBackgrounded = false;
	AppState.addEventListener('change', (next) => {
		if (next === 'background') wasBackgrounded = true;
		if (next === 'active' && wasBackgrounded) {
			wasBackgrounded = false;
			void useConnectionProfileStore.getState().refreshFromCloud();
		}
	});
}
