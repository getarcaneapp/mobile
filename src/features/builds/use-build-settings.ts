/**
 * State and actions for `BuildSettingsView` (BuildSettingsView.swift): the
 * flat build settings (workspace dir, provider, timeout, Depot credentials)
 * for one environment, with dirty tracking for the floating save bar.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { EnvironmentID } from '@/sdk/client/environment';
import type { PublicSetting } from '@/sdk/models/settings/Settings';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

type BuildSettingsFormState = {
	buildProvider: string;
	buildTimeout: string;
	buildsDirectory: string;
	depotProjectId: string;
	depotToken: string;
};

const defaults: BuildSettingsFormState = {
	buildProvider: 'local',
	buildTimeout: '1800',
	buildsDirectory: '',
	depotProjectId: '',
	depotToken: ''
};

export const buildProviderOptions: { label: string; value: string }[] = [
	{ label: 'Local', value: 'local' },
	{ label: 'Depot', value: 'depot' }
];

function sameState(a: BuildSettingsFormState, b: BuildSettingsFormState) {
	return (
		a.buildProvider === b.buildProvider &&
		a.buildTimeout === b.buildTimeout &&
		a.buildsDirectory === b.buildsDirectory &&
		a.depotProjectId === b.depotProjectId &&
		a.depotToken === b.depotToken
	);
}

/** Swift `trimmingCharacters(in: .whitespaces)` (spaces and tabs, not newlines). */
const trimWhitespace = (value: string) => value.replace(/^[ \t]+|[ \t]+$/g, '');

export function useBuildSettings(environmentID: EnvironmentID = EnvironmentID.localDocker) {
	const client = useClientManager((s) => s.client);
	const [form, setForm] = useState<BuildSettingsFormState>(defaults);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | undefined>();
	const [originalState, setOriginalState] = useState<BuildSettingsFormState | undefined>();
	/** Stands in for Swift's `Task.isCancelled`: a newer load or an unmount cancels older work. */
	const generation = useRef(0);

	useEffect(
		() => () => {
			generation.current += 1;
		},
		[]
	);

	const loadSettings = useCallback(async () => {
		if (!client) return;
		const token = ++generation.current;
		setIsLoading(true);
		setErrorMessage(undefined);
		setOriginalState(undefined);
		setForm(defaults);
		try {
			const dtos: PublicSetting[] = await client.settings.getSettings({ envID: environmentID });
			if (token !== generation.current) return;
			const dict = new Map(dtos.map((dto) => [dto.key, dto.value]));
			const loaded: BuildSettingsFormState = {
				buildProvider: dict.get('buildProvider') ?? 'local',
				buildTimeout: dict.get('buildTimeout') ?? '1800',
				buildsDirectory: dict.get('buildsDirectory') ?? '',
				depotProjectId: dict.get('depotProjectId') ?? '',
				depotToken: dict.get('depotToken') ?? ''
			};
			setForm(loaded);
			setOriginalState(loaded);
		} catch (error) {
			if (token !== generation.current) return;
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			if (token === generation.current) setIsLoading(false);
		}
	}, [client, environmentID]);

	useEffect(() => {
		void loadSettings();
	}, [loadSettings]);

	const hasChanges = !isLoading && originalState !== undefined && !sameState(form, originalState);

	const revertChanges = () => {
		if (!originalState) return;
		setForm(originalState);
		setErrorMessage(undefined);
	};

	const save = async () => {
		if (!client) return;
		const timeout = Number(trimWhitespace(form.buildTimeout));
		if (
			trimWhitespace(form.buildTimeout) !== '' &&
			Number.isInteger(timeout) &&
			(timeout < 60 || timeout > 14400)
		) {
			setErrorMessage('Build Timeout must be between 60 and 14400 seconds.');
			return;
		}
		const token = generation.current;
		const snapshot = form;
		setIsSaving(true);
		setErrorMessage(undefined);
		try {
			// Settings are flat string key/values server-side; send a raw dict instead of
			// the SDK's UpdateSettings struct.
			const body: Record<string, string> = {
				buildProvider: snapshot.buildProvider,
				buildTimeout: snapshot.buildTimeout
			};
			const trimmedDir = trimWhitespace(snapshot.buildsDirectory);
			if (trimmedDir !== '') body.buildsDirectory = trimmedDir;
			if (snapshot.buildProvider === 'depot') {
				const trimmedProject = trimWhitespace(snapshot.depotProjectId);
				if (trimmedProject !== '') body.depotProjectId = trimmedProject;
				if (snapshot.depotToken !== '') body.depotToken = snapshot.depotToken;
			}
			await client.rest.put<PublicSetting[]>(
				client.rest.environmentPath(environmentID, 'settings'),
				{ body }
			);
			if (token !== generation.current) return;
			setOriginalState(snapshot);
			showToast(Toasts.success('Build settings saved'));
		} catch (error) {
			if (token !== generation.current) return;
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			if (token === generation.current) setIsSaving(false);
		}
	};

	const update = (patch: Partial<BuildSettingsFormState>) =>
		setForm((current) => ({ ...current, ...patch }));

	return {
		form,
		setBuildProvider: (value: string) => update({ buildProvider: value }),
		setBuildTimeout: (value: string) => update({ buildTimeout: value }),
		setBuildsDirectory: (value: string) => update({ buildsDirectory: value }),
		setDepotProjectId: (value: string) => update({ depotProjectId: value }),
		setDepotToken: (value: string) => update({ depotToken: value }),
		isLoading,
		isSaving,
		errorMessage,
		hasChanges,
		loadSettings,
		revertChanges,
		save: () => void save()
	};
}

export type BuildSettingsModel = ReturnType<typeof useBuildSettings>;
