import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { UpdateJobScheduleConfig } from '@/sdk/models/jobSchedule/JobSchedule';
import { useClientManager } from '@/stores/client-manager';
import type { SystemColorName } from '@/theme/colors';
import { showToast, Toasts } from '@/ui/toast';

export type JobScheduleField = { key: string; label: string; icon: string; tint: SystemColorName };

export const jobScheduleFields: readonly JobScheduleField[] = [
	{
		key: 'autoHealInterval',
		label: 'Auto Heal',
		icon: 'heart.text.square.fill',
		tint: 'pink'
	},
	{
		key: 'autoUpdateInterval',
		label: 'Auto Update',
		icon: 'arrow.triangle.2.circlepath',
		tint: 'blue'
	},
	{
		key: 'dockerClientRefreshInterval',
		label: 'Docker Client Refresh',
		icon: 'shippingbox.fill',
		tint: 'blue'
	},
	{
		key: 'environmentHealthInterval',
		label: 'Agent Health',
		icon: 'waveform.path.ecg',
		tint: 'green'
	},
	{
		key: 'eventCleanupInterval',
		label: 'Event Cleanup',
		icon: 'trash.fill',
		tint: 'red'
	},
	{
		key: 'pollingInterval',
		label: 'Polling',
		icon: 'dot.radiowaves.left.and.right',
		tint: 'teal'
	},
	{
		key: 'scheduledPruneInterval',
		label: 'Scheduled Prune',
		icon: 'scissors',
		tint: 'orange'
	},
	{
		key: 'vulnerabilityScanInterval',
		label: 'Vulnerability Scan',
		icon: 'shield.lefthalf.filled',
		tint: 'purple'
	}
];

const updatableKeys = {
	autoHealInterval: true,
	autoUpdateInterval: true,
	dockerClientRefreshInterval: true,
	environmentHealthInterval: true,
	eventCleanupInterval: true,
	pollingInterval: true,
	scheduledPruneInterval: true,
	vulnerabilityScanInterval: true
} satisfies Partial<Record<keyof UpdateJobScheduleConfig, true>>;

const isUpdatable = (key: string): key is keyof typeof updatableKeys => key in updatableKeys;

type Values = Readonly<Record<string, string | undefined>>;

function jobScheduleValues(settings: readonly { key: string; value: string }[]) {
	const dict: Record<string, string> = {};
	for (const setting of settings) {
		if (jobScheduleFields.some((field) => field.key === setting.key))
			dict[setting.key] = setting.value;
	}
	return dict;
}

export function useJobScheduleConfig(environmentID: EnvironmentID) {
	const [values, setValues] = useState<Values>({});
	const [original, setOriginal] = useState<Values>({});
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	const hasChanges = jobScheduleFields.some(
		(field) => (values[field.key] ?? '') !== (original[field.key] ?? '')
	);
	const valuesEmpty = Object.keys(values).length === 0;
	const valuesEmptyRef = useRef(valuesEmpty);
	useLayoutEffect(() => {
		valuesEmptyRef.current = valuesEmpty;
	});

	const load = useCallback(
		async (refresh = false) => {
			const client = useClientManager.getState().client;
			if (!client) return;
			if (valuesEmptyRef.current) setIsLoading(true);
			if (refresh) setErrorMessage(undefined);
			await withCleanup(
				async () => {
					try {
						const settings = await client.settings.getSettings({ envID: environmentID });
						const dict = jobScheduleValues(settings);
						setValues(dict);
						setOriginal(dict);
						setErrorMessage(undefined);
					} catch (error) {
						setErrorMessage(friendlyErrorMessage(error));
					}
				},
				() => setIsLoading(false)
			);
		},
		[environmentID]
	);

	useEffect(() => {
		void load();
	}, [load]);

	const save = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsSaving(true);
		setErrorMessage(undefined);
		await withCleanup(
			async () => {
				const changed: Record<string, string> = {};
				for (const field of jobScheduleFields) {
					const value = (values[field.key] ?? '').trim();
					if (value === (original[field.key] ?? '')) continue;
					if (value === '') {
						setErrorMessage(`${field.label} can't be empty.`);
						return;
					}
					changed[field.key] = value;
				}
				if (Object.keys(changed).length === 0) return;

				const update: UpdateJobScheduleConfig = {};
				for (const [key, value] of Object.entries(changed)) {
					if (isUpdatable(key)) update[key] = value;
				}
				try {
					await client.jobs.updateSchedules({ body: update, envID: environmentID });
					setOriginal((current) => ({ ...current, ...changed }));
					setValues((current) => ({ ...current, ...changed }));
					showToast(Toasts.success('Schedules saved'));
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => setIsSaving(false)
		);
	}, [values, original, environmentID]);

	return {
		values,
		isLoading,
		isSaving,
		errorMessage,
		hasChanges,
		showsLoading: isLoading && valuesEmpty,
		value: (key: string) => values[key] ?? '',
		setValue: (key: string, value: string) =>
			setValues((current) => ({ ...current, [key]: value })),
		discardChanges: () =>
			setValues((current) => {
				const next: Record<string, string | undefined> = { ...current };
				for (const field of jobScheduleFields) next[field.key] = original[field.key];
				return next;
			}),
		load,
		refresh: () => load(true),
		save: () => void save()
	};
}

export type JobScheduleConfigModel = ReturnType<typeof useJobScheduleConfig>;
