import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import {
	NotificationTestType,
	type NotificationProvider
} from '@/sdk/models/notification/Notification';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';
import {
	NotificationProviderFormState,
	providerDisplayName,
	StableHeaderRow,
	StableStringRow,
	type EventSubscriptions
} from './notification-provider-models';
import type { NotificationProviderFormPayload } from './use-notification-settings';

type StringRowsKey = 'recipients' | 'tags' | 'devices';

export function useNotificationProviderForm() {
	const params = useLocalSearchParams<{
		provider?: string;
		payload?: string;
	}>();
	const [payload] = useState(() =>
		settingsPayloads.get<NotificationProviderFormPayload>(params.payload)
	);
	useEffect(() => () => settingsPayloads.delete(params.payload), [params.payload]);
	const provider = (payload?.provider ?? params.provider ?? 'generic') as NotificationProvider;
	const existing = payload?.existing;

	const client = useClientManager((s) => s.client);
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	const supportsPost26Features = useClientManager((s) => s.supportsPost26MobileFeatures);
	const navigation = useSettingsNavigation();

	const [state, setState] = useState(() => NotificationProviderFormState.make(provider, existing));
	const [originalState, setOriginalState] = useState(state);
	const [isSaving, setIsSaving] = useState(false);
	const [isTesting, setIsTesting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [selectedTestType, setSelectedTestType] = useState<NotificationTestType>(
		NotificationTestType.simple
	);
	const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);
	const [showsSaveBeforeTestConfirmation, setShowsSaveBeforeTestConfirmation] = useState(false);

	const latest = useRef({ state, originalState });
	latest.current = { state, originalState };

	const hasChanges = !NotificationProviderFormState.equals(state, originalState);
	const isValid = !state.enabled || NotificationProviderFormState.isValid(state, provider);

	const update = <Key extends keyof NotificationProviderFormState>(
		key: Key,
		value: NotificationProviderFormState[Key]
	) => setState((current) => ({ ...current, [key]: value }));
	const updateEvent = (key: keyof EventSubscriptions, value: boolean) =>
		setState((current) => ({
			...current,
			events: { ...current.events, [key]: value }
		}));

	const rows = {
		add: (key: StringRowsKey) =>
			setState((current) => ({
				...current,
				[key]: [...current[key], StableStringRow.make()]
			})),
		set: (key: StringRowsKey, id: string, value: string) =>
			setState((current) => ({
				...current,
				[key]: current[key].map((row) => (row.id === id ? { ...row, value } : row))
			})),
		remove: (key: StringRowsKey, indices: number[]) =>
			setState((current) => ({
				...current,
				[key]: current[key].filter((_, index) => !indices.includes(index))
			}))
	};

	const headers = {
		add: () =>
			setState((current) => ({
				...current,
				headers: [...current.headers, StableHeaderRow.make()]
			})),
		set: (id: string, change: { name?: string; value?: string }) =>
			setState((current) => ({
				...current,
				headers: current.headers.map((row) => (row.id === id ? { ...row, ...change } : row))
			})),
		remove: (indices: number[]) =>
			setState((current) => ({
				...current,
				headers: current.headers.filter((_, index) => !indices.includes(index))
			}))
	};

	const revertChanges = () => {
		setState(latest.current.originalState);
		setErrorMessage(undefined);
	};

	const save = async (dismissAfterSave: boolean): Promise<boolean> => {
		const current = latest.current.state;
		const currentIsValid =
			!current.enabled || NotificationProviderFormState.isValid(current, provider);
		if (!client || !currentIsValid) return false;
		setIsSaving(true);
		setErrorMessage(undefined);
		try {
			await client.notifications.upsertSettings({
				body: {
					enabled: current.enabled,
					config: NotificationProviderFormState.configuration(
						current,
						provider,
						supportsPost26Features
					)
				},
				envID: activeEnvironmentID
			});
			setOriginalState(latest.current.state);
			await payload?.onSaved();
			if (dismissAfterSave) {
				showToast(Toasts.success('Notification settings saved'));
				navigation.back();
			}
			return true;
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
			return false;
		} finally {
			setIsSaving(false);
		}
	};

	const testNotification = async () => {
		if (!client) return;
		const { state: current, originalState: original } = latest.current;
		if (!NotificationProviderFormState.equals(current, original)) {
			const saved = await save(false);
			if (!saved) return;
		}

		setIsTesting(true);
		try {
			const response = await client.notifications.test({
				provider,
				type: selectedTestType,
				envID: activeEnvironmentID
			});
			if (response.warning) {
				showToast(Toasts.info(response.warning));
			} else {
				showToast(Toasts.success('Test notification sent'));
			}
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		} finally {
			setIsTesting(false);
		}
	};

	const sendTest = () => {
		if (hasChanges) setShowsSaveBeforeTestConfirmation(true);
		else void testNotification();
	};

	return {
		provider,
		title: providerDisplayName[provider],
		isNew: existing === undefined,
		supportsPost26Features,
		state,
		update,
		updateEvent,
		rows,
		headers,
		hasChanges,
		isValid,
		isSaving,
		isTesting,
		errorMessage,
		selectedTestType,
		setSelectedTestType,
		isAdvancedExpanded,
		setIsAdvancedExpanded,
		showsSaveBeforeTestConfirmation,
		setShowsSaveBeforeTestConfirmation,
		sendTest,
		testNotification,
		saveAndDismiss: () => void save(true),
		revertChanges
	};
}

export type NotificationProviderFormModel = ReturnType<typeof useNotificationProviderForm>;

export const secretPlaceholder = (model: NotificationProviderFormModel) =>
	model.isNew ? 'Required' : 'Keep current value';

export const testTypeOptions = NotificationTestType.allCases;
