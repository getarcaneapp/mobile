import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTabStackGroup } from '@/features/navigation/tab-stack-group';
import { AppState } from 'react-native';

import { withCleanup } from '@/core/with-cleanup';
import { usePermission } from '@/core/auth/permissions';
import {
	boundedAPIResponse,
	boundedDirectResponse,
	RemoteDataLimits
} from '@/core/networking/remote-data-limits';
import { EnvironmentID } from '@/sdk/client/environment';
import type { EnvironmentVersion } from '@/sdk/models/environment/EnvironmentModel';
import { DockerInfo } from '@/sdk/models/system/DockerInfo';
import { User } from '@/sdk/models/user/User';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentsStore } from '@/stores/environments-store';
import {
	draftHasChanges,
	useDraft,
	useEnvironmentSettingsDraft
} from '@/ui/components/settings-form-draft';
import type { EnvironmentSecuritySection } from '@/ui/components/settings-form.types';
import { showToast, Toasts } from '@/ui/toast';

import {
	allEnvironmentSettingsFields,
	decodeEnvironmentDetails,
	environmentDetailSectionCases,
	environmentDetailSectionImage,
	isSettingsSection,
	type EnvironmentDetailSection,
	type EnvironmentDetails
} from './environment-detail-model';

const refreshIntervalMs = 30_000;

function useIsNotBackground() {
	const [value, setValue] = useState(AppState.currentState !== 'background');
	useEffect(() => {
		const subscription = AppState.addEventListener('change', (state) =>
			setValue(state !== 'background')
		);
		return () => subscription.remove();
	}, []);
	return value;
}

export function useEnvironmentDetail(environmentID: string, environmentName: string) {
	const router = useRouter();
	const group = useTabStackGroup('(dashboard)');

	const clientGeneration = useClientManager((s) => s.clientGeneration);
	const serverURL = useClientManager((s) => s.serverURL);
	const currentUser = useClientManager((s) => s.currentUser);
	const storeEnvironment = useEnvironmentsStore((s) =>
		s.environments.find((environment) => environment.id === environmentID)
	);
	const canReadSettings = usePermission('settings:read', environmentID);
	const canEditSettings = usePermission('settings:write', environmentID);
	const isNotBackground = useIsNotBackground();

	const [dockerInfo, setDockerInfo] = useState<DockerInfo>();
	const [versionInfo, setVersionInfo] = useState<EnvironmentVersion>();
	const [details, setDetails] = useState<EnvironmentDetails>();
	const [staticError, setStaticError] = useState<string>();
	const [environmentError, setEnvironmentError] = useState<string>();
	const [versionError, setVersionError] = useState<string>();
	const [isLoading, setIsLoading] = useState(false);
	const [selectedTab, setSelectedTab] = useState<EnvironmentDetailSection>(
		environmentID === EnvironmentID.localDocker ? 'Info' : 'Connection'
	);
	const [securitySection, setSecuritySection] = useState<EnvironmentSecuritySection>('Scanning');

	const { draft, token: draftToken } = useEnvironmentSettingsDraft(environmentID, environmentName);
	const hasChanges = useDraft(draft, draftHasChanges);
	const isSaving = useDraft(draft, (s) => s.isSaving);
	const draftIsLoading = useDraft(draft, (s) => s.isLoading);
	const draftHasLoaded = useDraft(draft, (s) => s.hasLoaded);
	const draftError = useDraft(draft, (s) => s.errorMessage);

	const environment = details?.environment ?? storeEnvironment;
	const title = environment?.name ?? environmentName;
	const isAdmin = currentUser ? User.isAdmin(currentUser) : false;

	const showsSettings = environment?.enabled !== false && canReadSettings;
	const sections = useMemo(
		() =>
			environmentDetailSectionCases.filter((section) => {
				switch (section) {
					case 'Connection':
						return environmentID !== EnvironmentID.localDocker;
					case 'Info':
					case 'GitOps':
						return true;
					default:
						return showsSettings;
				}
			}),
		[environmentID, showsSettings]
	);

	const isLoadingRef = useRef(false);
	const runRef = useRef(0);

	const loadEnvironment = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		const generation = useClientManager.getState().clientGeneration;
		const run = runRef.current;
		const stale = () =>
			run !== runRef.current || generation !== useClientManager.getState().clientGeneration;
		try {
			const loaded = await boundedAPIResponse(
				client,
				`environments/${encodeURIComponent(environmentID)}`,
				{
					decode: decodeEnvironmentDetails
				}
			);
			if (stale()) return;
			setDetails(loaded);
			setEnvironmentError(undefined);
		} catch {
			if (stale()) return;
			setEnvironmentError('Connection details could not be refreshed. Pull to refresh to retry.');
		}
	}, [environmentID]);

	const loadStatic = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client || isLoadingRef.current) return;
		const generation = useClientManager.getState().clientGeneration;
		const run = runRef.current;
		isLoadingRef.current = true;
		setIsLoading(true);
		await withCleanup(
			async () => {
				const [, info, version] = await Promise.all([
					loadEnvironment(),
					boundedDirectResponse(
						client,
						client.rest.environmentPath(environmentID, 'system/docker/info'),
						{
							maximumBytes: RemoteDataLimits.maximumInspectBytes,
							decode: DockerInfo.decode
						}
					).catch(() => undefined),
					client.environments.version({ id: environmentID }).catch(() => undefined)
				]);
				if (run !== runRef.current || generation !== useClientManager.getState().clientGeneration)
					return;
				if (info) {
					setDockerInfo(info);
					setStaticError(undefined);
				} else {
					setStaticError('Docker information could not be refreshed. Pull to refresh to retry.');
				}
				if (version) {
					setVersionInfo(version);
					setVersionError(undefined);
				} else {
					setVersionError('Arcane version unavailable for this environment.');
				}
			},
			() => {
				if (run === runRef.current && generation === useClientManager.getState().clientGeneration) {
					isLoadingRef.current = false;
					setIsLoading(false);
				}
			}
		);
	}, [environmentID, loadEnvironment]);

	const loadKey = `${clientGeneration}|${environmentID}|${isNotBackground}`;
	const loadedKeyRef = useRef<string | undefined>(undefined);

	useFocusEffect(
		useCallback(() => {
			if (!isNotBackground) {
				loadedKeyRef.current = undefined;
				return;
			}
			if (loadedKeyRef.current !== loadKey) {
				loadedKeyRef.current = loadKey;
				runRef.current += 1;
				isLoadingRef.current = false;
				setIsLoading(false);
				setDetails(undefined);
				setDockerInfo(undefined);
				setVersionInfo(undefined);
				setEnvironmentError(undefined);
				setStaticError(undefined);
				setVersionError(undefined);
			}
			void loadStatic();
			const timer = setInterval(() => void loadEnvironment(), refreshIntervalMs);
			return () => {
				clearInterval(timer);
				runRef.current += 1;
				isLoadingRef.current = false;
				setIsLoading(false);
			};
		}, [loadKey, isNotBackground, loadStatic, loadEnvironment])
	);

	const loadSettings = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		await draft.getState().load(client, allEnvironmentSettingsFields);
	}, [draft]);

	useEffect(() => {
		const first = sections[0];
		if (!sections.includes(selectedTab) && first) {
			setSelectedTab(first);
			return;
		}
		if (isSettingsSection(selectedTab) && !draft.getState().hasLoaded) void loadSettings();
	}, [selectedTab, sections, draft, loadSettings]);

	const refresh = useCallback(async () => {
		await loadStatic();
		if (isSettingsSection(selectedTab)) await loadSettings();
	}, [loadStatic, loadSettings, selectedTab]);

	const saveSettings = useCallback(() => {
		void (async () => {
			const client = useClientManager.getState().client;
			if (!client) return;
			if (await draft.getState().save(client, allEnvironmentSettingsFields))
				showToast(Toasts.success('Settings saved'));
		})();
	}, [draft]);

	const revertSettings = useCallback(() => draft.getState().revert(), [draft]);

	const push = useCallback(
		(path: string, params: Record<string, string>) => {
			const query = Object.entries(params)
				.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
				.join('&');
			router.push(`/(tabs)/${group}/${path}${query ? `?${query}` : ''}` as Href);
		},
		[router, group]
	);
	const openUpgrade = useCallback(
		() => push('system-upgrade', { envID: environmentID, name: title }),
		[push, environmentID, title]
	);
	const openSchedules = useCallback(
		() =>
			push(`environment/${encodeURIComponent(environmentID)}/schedules`, {
				name: environment?.name ?? ''
			}),
		[push, environmentID, environment?.name]
	);
	const openGitOps = useCallback(
		() => push(`environment/${encodeURIComponent(environmentID)}/gitops`, {}),
		[push, environmentID]
	);

	const tabOptions = sections.map((section) => ({
		value: section,
		title: section,
		systemImage: environmentDetailSectionImage[section]
	}));

	return {
		environmentID,
		title,
		environment,
		details,
		dockerInfo,
		versionInfo,
		staticError,
		environmentError,
		versionError,
		isLoading,
		managerURL: serverURL,
		isAdmin,
		sections,
		tabOptions,
		selectedTab,
		setSelectedTab,
		securitySection,
		setSecuritySection,
		draft,
		draftToken,
		canEditSettings,
		hasChanges,
		isSaving,
		draftIsLoading,
		draftHasLoaded,
		draftError,
		showsSaveBar: isSettingsSection(selectedTab) || hasChanges,
		refresh,
		saveSettings,
		revertSettings,
		openUpgrade,
		openSchedules,
		openGitOps
	};
}

export type EnvironmentDetailModel = ReturnType<typeof useEnvironmentDetail>;
