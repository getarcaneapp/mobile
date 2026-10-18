import { Directory, File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Platform } from 'react-native';

import type { ArcaneAuthorizedRequest } from '@/sdk/client/ArcaneTransport';
import type { EnvironmentID } from '@/sdk/client/environment';
import { CancellationError } from '@/sdk/errors/ArcaneError';
import type { UpdateBackupPolicy } from '@/sdk/models/backup/UpdateBackupPolicy';
import type { VolumeBackupPolicy } from '@/sdk/models/backup/VolumeBackupPolicy';
import { useClientManager } from '@/stores/client-manager';

import { uuidString } from './volume-model';

export class BackupRequestScope {
	readonly generation: number;
	readonly environmentID: EnvironmentID;

	constructor() {
		const state = useClientManager.getState();
		this.generation = state.clientGeneration;
		this.environmentID = state.activeEnvironmentID;
	}

	check(isCancelled?: () => boolean) {
		if (isCancelled?.()) throw new CancellationError();
		const state = useClientManager.getState();
		if (
			this.generation !== state.clientGeneration ||
			this.environmentID !== state.activeEnvironmentID
		) {
			throw new CancellationError();
		}
	}
}

export function useBackupSessionScope() {
	const router = useRouter();
	const generation = useClientManager((s) => s.clientGeneration);
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	const initial = useRef({ generation, activeEnvironmentID });
	useEffect(() => {
		if (
			generation !== initial.current.generation ||
			activeEnvironmentID !== initial.current.activeEnvironmentID
		) {
			initial.current = { generation, activeEnvironmentID };
			if (router.canGoBack()) router.back();
		}
	}, [generation, activeEnvironmentID, router]);
}

export function useUnmounted() {
	const unmounted = useRef(false);
	useEffect(() => {
		unmounted.current = false;
		return () => {
			unmounted.current = true;
		};
	}, []);
	return unmounted;
}

export type BackupPolicyDraft = {
	id: string;
	isNew: boolean;
	enabled: boolean;
	schedule: string;
	retentionCount: number;
	stopContainers: boolean;
	localEnabled: boolean;
	s3Enabled: boolean;
	s3DestinationId: string;
};

export const BackupPolicyDraft = {
	make(this: void): BackupPolicyDraft {
		return {
			id: uuidString(),
			isNew: true,
			enabled: false,
			schedule: '0 0 2 * * *',
			retentionCount: 7,
			stopContainers: false,
			localEnabled: true,
			s3Enabled: false,
			s3DestinationId: ''
		};
	},
	fromVolumePolicy(this: void, p: VolumeBackupPolicy): BackupPolicyDraft {
		return {
			id: p.id,
			isNew: false,
			enabled: p.enabled,
			schedule: p.schedule,
			retentionCount: p.retentionCount,
			stopContainers: p.stopContainers,
			localEnabled: p.localEnabled,
			s3Enabled: p.s3Enabled,
			s3DestinationId: p.s3DestinationId ?? ''
		};
	},
	isValid(this: void, d: BackupPolicyDraft): boolean {
		return (
			d.schedule.trim() !== '' &&
			d.retentionCount >= 0 &&
			d.retentionCount <= 3650 &&
			(d.localEnabled || d.s3Enabled) &&
			(!d.s3Enabled || d.s3DestinationId !== '')
		);
	},
	update(this: void, d: BackupPolicyDraft): UpdateBackupPolicy {
		return {
			id: d.isNew ? undefined : d.id,
			enabled: d.enabled,
			schedule: d.schedule,
			retentionCount: d.retentionCount,
			stopContainers: d.stopContainers,
			localEnabled: d.localEnabled,
			s3Enabled: d.s3Enabled,
			s3DestinationId: d.s3DestinationId === '' ? undefined : d.s3DestinationId
		};
	}
} as const;

export type VolumeWorkspaceDraft = { text: string; baseline: string; conflict: boolean };

export const VolumeWorkspaceDraft = {
	empty: { text: '', baseline: '', conflict: false } as VolumeWorkspaceDraft,
	hasChanges: (d: VolumeWorkspaceDraft) => d.text !== d.baseline,
	load: (content: string): VolumeWorkspaceDraft => ({
		text: content,
		baseline: content,
		conflict: false
	}),
	review: (d: VolumeWorkspaceDraft, latest: string): VolumeWorkspaceDraft => ({
		...d,
		baseline: latest,
		conflict: false
	}),
	validRelativePath(path: string): boolean {
		return (
			path !== '' &&
			!path.startsWith('/') &&
			!path.includes('\0') &&
			!path.split('/').some((part) => part === '' || part === '..' || part === '.')
		);
	}
} as const;

export function confirmationDialog({
	title,
	message,
	actionTitle,
	onConfirm
}: {
	title: string;
	message?: string;
	actionTitle: string;
	onConfirm: () => void;
}) {
	if (Platform.OS === 'ios') {
		ActionSheetIOS.showActionSheetWithOptions(
			{
				title,
				message,
				options: [actionTitle, 'Cancel'],
				destructiveButtonIndex: 0,
				cancelButtonIndex: 1
			},
			(index) => {
				if (index === 0) onConfirm();
			}
		);
		return;
	}
	Alert.alert(title, message, [
		{ text: 'Cancel', style: 'cancel' },
		{ text: actionTitle, style: 'destructive', onPress: onConfirm }
	]);
}

export function showErrorAlert(title: string, message: string) {
	Alert.alert(title, message, [{ text: 'OK', style: 'cancel' }]);
}

export function makeTemporaryDirectory(): Directory {
	const directory = new Directory(Paths.cache, uuidString());
	directory.create({ intermediates: true, idempotent: true });
	return directory;
}

export function removeItem(item: File | Directory | undefined) {
	try {
		if (item?.exists) item.delete();
	} catch {}
}

export async function downloadTo(
	request: ArcaneAuthorizedRequest,
	destination: File
): Promise<File> {
	return File.downloadFileAsync(request.url, destination, {
		headers: request.headers,
		idempotent: true
	});
}

export async function shareFile(file: File) {
	await Sharing.shareAsync(file.uri);
}

export function useLatestState<T>(initial: T) {
	const [value, setValue] = useState(initial);
	const ref = useRef(value);
	useLayoutEffect(() => {
		ref.current = value;
	});
	const set = useCallback((next: T | ((current: T) => T)) => {
		setValue((current) => {
			const resolved = typeof next === 'function' ? (next as (current: T) => T)(current) : next;
			ref.current = resolved;
			return resolved;
		});
	}, []);
	return [value, set, ref] as const;
}
