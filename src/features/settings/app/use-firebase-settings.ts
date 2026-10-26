import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';

import {
	emptyFirebaseSettings,
	parseGoogleServices,
	validateFirebaseSettings,
	type FirebaseSettings
} from '@/core/firebase-config';
import { usePushNotificationCoordinator } from '@/stores/push-notification-coordinator';
import { showToast, Toasts } from '@/ui/toast';

import { ArcaneFirebase, type FirebaseApplyResult } from '../../../../modules/arcane-firebase';

async function saveSettings(settings: FirebaseSettings): Promise<string | undefined> {
	const problem = validateFirebaseSettings(settings);
	if (problem) return problem;
	let result: FirebaseApplyResult;
	try {
		result = await ArcaneFirebase.setOptions(settings);
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
	return finishApply(result);
}

async function finishApply(result: FirebaseApplyResult): Promise<string | undefined> {
	if (result === 'failed') return 'Firebase did not start with these values.';
	if (result === 'restart') {
		showToast(Toasts.info('Restarting the app to apply'));
		await new Promise((resolve) => setTimeout(resolve, 1200));
		ArcaneFirebase.restart();
		return undefined;
	}
	await usePushNotificationCoordinator.getState().firebaseDidChange();
	return undefined;
}

async function clearSettings() {
	await finishApply(await ArcaneFirebase.clearOptions());
}

async function readClipboardSettings(): Promise<string | FirebaseSettings> {
	const raw = await Clipboard.getStringAsync();
	const result = parseGoogleServices(raw, Application.applicationId ?? '');
	return result.ok ? result.settings : result.message;
}

export function useFirebaseSettings() {
	const [settings, setSettings] = useState<FirebaseSettings>(
		() => ArcaneFirebase.getOptions() ?? emptyFirebaseSettings
	);
	const [busy, setBusy] = useState(false);
	const firebaseReady = usePushNotificationCoordinator((s) => s.firebaseReady);

	const setField = (field: keyof FirebaseSettings, value: string) =>
		setSettings((current) => ({ ...current, [field]: value }));

	const importFromClipboard = () => {
		void (async () => {
			const result = await readClipboardSettings();
			if (typeof result === 'string') {
				showToast(Toasts.error(result));
				return;
			}
			setSettings(result);
			showToast(Toasts.info('Imported from google-services.json. Tap Save to apply.'));
		})();
	};

	const save = () => {
		setBusy(true);
		void (async () => {
			const problem = await saveSettings(settings);
			setBusy(false);
			if (problem) showToast(Toasts.error(problem));
			else showToast(Toasts.success('Firebase settings saved'));
		})();
	};

	const clear = () => {
		setBusy(true);
		void (async () => {
			await clearSettings();
			setBusy(false);
			setSettings(emptyFirebaseSettings);
			showToast(Toasts.info('Firebase settings removed'));
		})();
	};

	return {
		settings,
		setField,
		busy,
		firebaseReady,
		packageName: Application.applicationId ?? '',
		importFromClipboard,
		save,
		clear
	};
}

export const FirebaseSettingsCopy = {
	importFooter:
		'Copy the contents of google-services.json, then tap Import. The app picks the entry for its own package name.',
	valuesFooter:
		'Use the values of your own Firebase project. Your push relay must send with a service account of the same project.'
} as const;
