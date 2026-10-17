import { Platform } from 'react-native';

import { ArcaneCloudSync, type CloudItemOptions } from '../../../modules/arcane-cloud-sync';
import {
	ConnectionCredentialRecord,
	ConnectionProfilePayload,
	decodeConnectionProfilePayload,
	type ConnectionProfileRecord
} from '@/core/connection-profiles/connection-profile-sync';

const profileService = 'com.getarcaneapp.ios.mobile.connection-profile.v1';
const credentialService = 'com.getarcaneapp.ios.mobile.connection-credential.v1';

const profileItem: CloudItemOptions = {
	accessGroup: '4L6GXKX423.com.getarcaneapp.ios.mobile.shared',
	accessible: 'afterFirstUnlock'
};
const credentialItem: CloudItemOptions = {
	accessGroup: '4L6GXKX423.com.getarcaneapp.ios.mobile',
	accessible: 'whenUnlocked'
};
const androidPayloadAccount = 'payload';

const sortedJSON = (value: object) => JSON.stringify(value, Object.keys(value).sort());

const parse = (raw: string): unknown => {
	try {
		return JSON.parse(raw);
	} catch {
		return undefined;
	}
};

export type ProfileCloudKind = 'iCloudKeychain' | 'googleBackup' | 'deviceOnly';

export const profileCloud = {
	async kind(): Promise<ProfileCloudKind> {
		if (Platform.OS === 'ios') return 'iCloudKeychain';
		const status = await ArcaneCloudSync.getStatus();
		if (!status.available) throw new Error('Block Store is unavailable');
		return status.cloudBackup ? 'googleBackup' : 'deviceOnly';
	},

	async load(): Promise<ConnectionProfilePayload> {
		if (Platform.OS === 'ios') {
			const items = await ArcaneCloudSync.getAllItems(profileService, profileItem);
			const records = Object.entries(items).flatMap(([account, raw]) => {
				const record = decodeConnectionProfilePayload({ records: [parse(raw)] }).records[0];
				return record && record.id === account ? [record] : [];
			});
			return { version: ConnectionProfilePayload.schemaVersion, records };
		}
		const raw = await ArcaneCloudSync.getItem(profileService, androidPayloadAccount);
		return raw === undefined
			? ConnectionProfilePayload.empty
			: decodeConnectionProfilePayload(parse(raw));
	},

	async save(payload: ConnectionProfilePayload): Promise<void> {
		if (Platform.OS === 'ios') {
			for (const record of payload.records) {
				await ArcaneCloudSync.setItem(profileService, record.id, sortedJSON(record), profileItem);
			}
			return;
		}
		try {
			await ArcaneCloudSync.setItem(profileService, androidPayloadAccount, JSON.stringify(payload));
		} catch (error) {
			if ((error as { code?: string }).code !== 'ERR_TOO_LARGE') throw error;
			const records: ConnectionProfileRecord[] = payload.records.filter((r) => !r.isDeleted);
			await ArcaneCloudSync.setItem(
				profileService,
				androidPayloadAccount,
				JSON.stringify({ ...payload, records })
			);
		}
	}
};

export const credentialCloud = {
	isSupported: Platform.OS === 'ios',

	async profileIDs(): Promise<Set<string>> {
		return new Set(await ArcaneCloudSync.listAccounts(credentialService, credentialItem));
	},

	async load(profileID: string): Promise<ConnectionCredentialRecord | undefined> {
		const raw = await ArcaneCloudSync.getItem(credentialService, profileID, credentialItem);
		if (raw === undefined) return undefined;
		const record = ConnectionCredentialRecord.decode(parse(raw));
		if (record.profileID !== profileID)
			throw new Error("Credential item doesn't match its account");
		return record;
	},

	save(record: ConnectionCredentialRecord): Promise<void> {
		return ArcaneCloudSync.setItem(
			credentialService,
			record.profileID,
			sortedJSON(record),
			credentialItem
		);
	},

	delete(profileID: string): Promise<void> {
		return ArcaneCloudSync.deleteItem(credentialService, profileID, credentialItem);
	}
};

export const passwordManager = {
	isSupported: Platform.OS === 'android' && ArcaneCloudSync.isLinked,
	save: (username: string, password: string) => ArcaneCloudSync.savePassword(username, password),
	pick: () => ArcaneCloudSync.getPassword()
};
