import { useEffect, useRef, useState } from 'react';

import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentsStore } from '@/stores/environments-store';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { showToast, Toasts } from '@/ui/toast';

import { useUpdatesNavigation } from './updates-routes';

export type PickerMode = 'runUpdater' | 'history';

export const PickerMode = {
	title: (mode: PickerMode) => (mode === 'runUpdater' ? 'Run Updater' : 'Updater History')
} as const;

export function useUpdatesScreen() {
	const accent = useAccentColor();
	const client = useClientManager((s) => s.client);
	const allEnvironmentsPreview = useClientManager((s) => s.allEnvironmentsPreview);
	const navigation = useUpdatesNavigation();
	const [pickerMode, setPickerMode] = useState<PickerMode>();
	const [showsUpdaterSheet, setShowsUpdaterSheet] = useState(false);
	const [initialUpdaterEnvironmentID, setInitialUpdaterEnvironmentID] = useState<string>();
	const [presentedEnvironments, setPresentedEnvironments] = useState<Environment[]>([]);
	const pendingHistory = useRef<string | undefined>(undefined);

	useEffect(() => {
		void useEnvironmentsStore.getState().load();
	}, [client]);

	const launch = (mode: PickerMode) => {
		const { environments, errorMessage } = useEnvironmentsStore.getState();
		if (environments.length === 0) {
			if (errorMessage !== undefined) showToast(Toasts.error(errorMessage));
			return;
		}
		setPresentedEnvironments(environments);
		if (mode === 'runUpdater') {
			setInitialUpdaterEnvironmentID(environments.length === 1 ? environments[0]?.id : undefined);
			setShowsUpdaterSheet(true);
			return;
		}
		const only = environments[0];
		if (environments.length === 1 && only) navigation.openHistory(only.id);
		else setPickerMode(mode);
	};

	const pickEnvironment = (environment: Environment) => {
		pendingHistory.current = environment.id;
		setPickerMode(undefined);
	};

	const pickerDidDismiss = () => {
		const id = pendingHistory.current;
		pendingHistory.current = undefined;
		if (id !== undefined) navigation.openHistory(id);
	};

	const runUpdaterItem: ActionButtonItem = {
		id: 'run-updater',
		title: 'Run Updater',
		systemImage: 'play.fill',
		tint: systemColors.orange,
		action: () => launch('runUpdater')
	};

	const historyItem: ActionButtonItem = {
		id: 'updater-history',
		title: 'Updater History',
		systemImage: 'clock.arrow.circlepath',
		tint: accent,
		action: () => launch('history')
	};

	return {
		allEnvironmentsPreview,
		pickerMode,
		setPickerMode,
		showsUpdaterSheet,
		setShowsUpdaterSheet,
		initialUpdaterEnvironmentID,
		presentedEnvironments,
		pickEnvironment,
		pickerDidDismiss,
		runUpdaterItem,
		historyItem
	};
}
