import { randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import {
	credentialCloud,
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
		void SecureStore.deleteItemAsync(this.key(profileID), credentialOptions);
		updateIDSet(credentialIndexKey, profileID, false);
	}
};

const sameCredential = (a: ConnectionCredentialRecord | undefined, b: ConnectionCredentialRecord) =>
	a !== undefined &&
	a.serverURL === b.serverURL &&
	a.username === b.username &&
	a.password === b.password;

type ConnectionProfileStoreState = {
	profiles: ConnectionProfile[];
	credentialProfileIDs: ReadonlySet<string>;
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
		credential: SavedConnectionCredential | undefined
	) => ConnectionProfile;
	update: (profile: ConnectionProfile, name: string, serverURL: string) => ConnectionProfile;
	delete: (profile: ConnectionProfile) => void;
	saveCredential: (profile: ConnectionProfile, username: string, password: string) => void;
	removeCredential: (profile: ConnectionProfile) => void;
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
		} catch {
			set({ syncState: 'unavailable' });
		}
	};

	const syncCredentials = async () => {
		if (!credentialCloud.isSupported) return;
		const cloudIDs = await credentialCloud.profileIDs();
		const confirmed = idSet(credentialCloudIndexKey);
		for (const profile of get().profiles) {
			let local: ConnectionCredentialRecord | undefined;
			try {
				local = credentialPersistence.load(profile.id);
			} catch {
				local = undefined;
			}
			if (cloudIDs.has(profile.id)) {
				const remote = await credentialCloud.load(profile.id).catch(() => undefined);
				if (!remote || !ConnectionCredentialRecord.credential(remote, profile)) {
					await credentialCloud.delete(profile.id);
					if (local) credentialPersistence.delete(profile.id);
					confirmed.delete(profile.id);
					continue;
				}
				if (!sameCredential(local, remote)) credentialPersistence.save(remote);
				confirmed.add(profile.id);
			} else if (local) {
				if (confirmed.has(profile.id)) {
					credentialPersistence.delete(profile.id);
					confirmed.delete(profile.id);
				} else {
					await credentialCloud.save(local);
					confirmed.add(profile.id);
				}
			}
		}
		for (const id of confirmed) if (!get().profiles.some((p) => p.id === id)) confirmed.delete(id);
		writeIDSet(credentialCloudIndexKey, confirmed);
		refreshCredentialProfileIDs();
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
		refreshCredentialProfileIDs();
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

		saveConnectionProfile: (profile, name, serverURL, credential) => {
			const saved = profile ? get().update(profile, name, serverURL) : get().save(name, serverURL);
			if (credential) get().saveCredential(saved, credential.username, credential.password);
			else if (get().hasSavedCredential(saved)) get().removeCredential(saved);
			return saved;
		},

		update: (profile, name, serverURL) => {
			const normalized = ConnectionProfileSync.normalizedServerURL(serverURL);
			if (normalized !== profile.serverURL) get().removeCredential(profile);
			return write(profile.id, name, serverURL);
		},

		delete: (profile) => {
			get().removeCredential(profile);
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
				void enqueue('sign-in upload', async () => {
					await credentialCloud.save(record);
					updateIDSet(credentialCloudIndexKey, record.profileID, true);
					set({ syncState: 'iCloudKeychain' });
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
				void enqueue('sign-in delete', async () => {
					await credentialCloud.delete(profile.id);
					updateIDSet(credentialCloudIndexKey, profile.id, false);
				});
			}
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
