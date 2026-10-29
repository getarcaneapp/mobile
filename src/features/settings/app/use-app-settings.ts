import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import { Directory, Paths } from 'expo-file-system';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { AvatarDiskCache } from '@/core/auth/avatar-disk-cache';
import { formatFileBytes } from '@/core/networking/remote-data-limits';
import { ResponseCache } from '@/core/networking/response-cache';
import { defaults, Keys, storage, useStoredBool, useStoredString } from '@/core/storage';
import { useBusiestContainersStore } from '@/stores/busiest-containers-store';
import { useClientManager } from '@/stores/client-manager';
import { LiveStatsLimit } from '@/stores/dashboard-stream-logic';
import {
	systemNotificationSettingsName,
	usePushNotificationCoordinator
} from '@/stores/push-notification-coordinator';
import { useSystemStatsHistoryStore } from '@/stores/system-stats-history-store';
import { clearImageCache } from '@/ui/components/cached-async-image';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import { useSettingsNavigation } from '../shared/settings-routes';
import { ActivityToastScope } from './activity-toast-scope';
import { AppSettingsRoutes } from './app-settings-routes';

export const supportLinks = [
	{ title: 'Documentation', url: 'https://getarcane.app', systemImage: 'globe', color: 'blue' },
	{
		title: 'Report an Issue',
		url: 'https://github.com/getarcaneapp/mobile/issues',
		systemImage: 'exclamationmark.bubble',
		color: 'orange'
	},
	{
		title: 'Join the Discord',
		url: 'https://discord.gg/WyXYpdyV3Z',
		systemImage: 'bubble.left.and.bubble.right.fill',
		color: 'indigo'
	},
	{
		title: 'Privacy Policy',
		url: 'https://getarcane.app/privacy',
		systemImage: 'hand.raised.fill',
		color: 'gray'
	},
	{
		title: 'Buy Me a Coffee',
		url: 'https://buymeacoffee.com/kmendell',
		systemImage: 'cup.and.saucer.fill',
		color: 'orange'
	}
] as const;

function imageCacheDirectory(): Directory {
	return new Directory(
		Paths.cache,
		Platform.OS === 'ios' ? 'com.hackemist.SDImageCache' : 'image_manager_disk_cache'
	);
}

function cacheDiskBytes(): number {
	let images = 0;
	try {
		const directory = imageCacheDirectory();
		images = directory.exists ? (directory.size ?? 0) : 0;
	} catch {
		images = 0;
	}
	return images + AvatarDiskCache.diskBytes();
}

function useLiveStatsLimit(): [number, (value: number) => void] {
	const value = useSyncExternalStore(
		(listener) => storage.subscribe(LiveStatsLimit.preferenceKey, listener),
		() => defaults.getNumber(LiveStatsLimit.preferenceKey) ?? LiveStatsLimit.defaultValue
	);
	return [value, (next) => defaults.set(LiveStatsLimit.preferenceKey, next)];
}

type PendingDestructive = 'clearCache';

export function useAppSettings() {
	const [rememberLastTab, setRememberLastTab] = useStoredBool(Keys.rememberLastTab, true);
	const [liveStatsLimit, storeLiveStatsLimit] = useLiveStatsLimit();
	const [activityToastScopeRawValue, setActivityToastScopeRawValue] = useStoredString(
		ActivityToastScope.preferenceKey,
		ActivityToastScope.defaultValue
	);
	const [pendingDestructive, setPendingDestructive] = useState<PendingDestructive | undefined>();
	const [cacheSizeBytes, setCacheSizeBytes] = useState(0);

	const supportsMobilePush = useClientManager((s) => s.supportsMobilePush);
	const clientGeneration = useClientManager((s) => s.clientGeneration);
	const origin = useClientManager((s) => s.serverOrigin());
	const push = usePushNotificationCoordinator();
	const navigation = useSettingsNavigation();

	const refreshCacheSize = useCallback(() => setCacheSizeBytes(cacheDiskBytes()), []);

	useEffect(() => {
		refreshCacheSize();
	}, [refreshCacheSize]);

	useEffect(() => {
		const coordinator = usePushNotificationCoordinator.getState();
		void (async () => {
			await coordinator.refreshAuthorizationStatus();
			await coordinator.refreshServerStatus();
		})();
	}, [clientGeneration]);

	const setLiveStatsLimit = (value: number) => {
		storeLiveStatsLimit(value);
		useSystemStatsHistoryStore.getState().applyStreamLimit();
	};

	const activityToastScope = ActivityToastScope.from(activityToastScopeRawValue);
	const showsPushToggle = supportsMobilePush && push.isSupported;
	const pushAvailable = push.serverStatus?.enabled === true && !push.isAuthorizationDenied();
	const pushEnabled = push.isEnabled(origin);
	const showsFirebaseRow = push.isSupported && Platform.OS === 'android';
	const setPushEnabled = (enabled: boolean) => void (enabled ? push.enable() : push.disable());

	const notificationsFooter = (() => {
		const scope = ActivityToastScope.subtitle(activityToastScope);
		const toasts = `Toasts show ${scope.charAt(0).toLowerCase() + scope.slice(1)}.`;
		if (!showsPushToggle) return toasts;
		if (!push.firebaseReady) return toasts + ' Enter your Firebase settings to turn on push.';
		if (push.serverStatus?.enabled !== true)
			return toasts + ' Push is turned off on your Arcane server.';
		if (push.isAuthorizationDenied())
			return toasts + ` Notifications are off in ${systemNotificationSettingsName}.`;
		return toasts;
	})();

	const cacheSizeText = cacheSizeBytes > 0 ? formatFileBytes(cacheSizeBytes) : 'Empty';

	useItemDeleteConfirmation(pendingDestructive, setPendingDestructive, () => ({
		title: 'Clear Cache?',
		message:
			cacheSizeBytes > 0
				? `This will remove ${formatFileBytes(cacheSizeBytes)} of cached images. Everything will be re-fetched as needed.`
				: 'This will clear all cached images.',
		icon: 'trash',
		actions: [
			{
				title: 'Clear Cache',
				action: () => {
					void (async () => {
						await clearImageCache();
						AvatarDiskCache.clear();
						ResponseCache.invalidateAll();
						useBusiestContainersStore.getState().clearCache();
						refreshCacheSize();
						showToast(Toasts.success('Cache cleared'));
					})();
				}
			}
		]
	}));

	const appVersionString = Application.nativeApplicationVersion ?? '1.0';
	const appBuildString = Application.nativeBuildVersion ?? '—';

	const copyVersion = () => {
		void Clipboard.setStringAsync(`${appVersionString} (${appBuildString})`);
		showToast(Toasts.copied('Version copied'));
	};

	return {
		rememberLastTab,
		setRememberLastTab,
		liveStatsLimit,
		setLiveStatsLimit,
		activityToastScope,
		setActivityToastScope: (scope: ActivityToastScope) => setActivityToastScopeRawValue(scope),
		showsPushToggle,
		pushEnabled,
		setPushEnabled,
		pushToggleDisabled: push.isBusy || !pushAvailable || (!pushEnabled && !push.firebaseReady),
		showsFirebaseRow,
		firebaseReady: push.firebaseReady,
		openFirebaseSettings: () => navigation.push(AppSettingsRoutes.firebase),
		notificationsFooter,
		cacheSizeText,
		clearCache: () => setPendingDestructive('clearCache'),
		appVersionString,
		appBuildString,
		copyVersion
	};
}

export type AppSettingsModel = ReturnType<typeof useAppSettings>;
