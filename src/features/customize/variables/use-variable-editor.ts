/** The platform-neutral model behind `VariableEditorView` (VariablesView.swift). */
import { useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { useSettingsNavigation } from '@/features/settings/shared/settings-routes';
import { showToast, Toasts } from '@/ui/toast';

import { useRoutePayload } from '../dynamic-resources/dynamic-resource-routes';
import type { VariableEditorPayload } from './use-variables';
import type { VariableSaveRequest } from './variables-store';

export interface VariableEnvironmentOption {
	id: string;
	name: string;
}

export function useVariableEditor() {
	const nav = useSettingsNavigation();
	const payload = useRoutePayload<VariableEditorPayload>();
	const variable = payload?.variable;
	const environments = payload?.environments ?? [];

	const [key, setKey] = useState(variable?.key ?? '');
	const [value, setValue] = useState(variable?.isSecret ? '' : (variable?.value ?? ''));
	const [isSecret, setIsSecret] = useState(variable?.isSecret ?? false);
	const [allEnvironments, setAllEnvironments] = useState(variable?.allEnvironments ?? true);
	const [selectedEnvironmentIDs, setSelectedEnvironmentIDs] = useState<ReadonlySet<string>>(
		() => new Set(variable?.environmentIDs ?? [])
	);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	const isEditing = variable !== undefined;

	const known = new Set(environments.map((environment) => environment.id));
	const environmentOptions: VariableEnvironmentOption[] = [
		...environments.map((environment) => ({
			id: environment.id,
			name: environment.name || environment.id
		})),
		...[...selectedEnvironmentIDs].filter((id) => !known.has(id)).map((id) => ({ id, name: id }))
	].sort((lhs, rhs) => lhs.name.localeCompare(rhs.name, undefined, { sensitivity: 'base' }));

	const requiresReplacementValue = variable?.isSecret === true && !isSecret;

	const hasKey = key.trim() !== '';
	const hasScope = allEnvironments || selectedEnvironmentIDs.size > 0;
	const hasValue = value !== '';
	const valueIsValid = isEditing ? !requiresReplacementValue || hasValue : hasValue;
	const canSave = hasKey && hasScope && valueIsValid && !isSaving;

	const variableFooter =
		variable?.isSecret === true && isSecret
			? 'The current secret cannot be revealed. Leave the value blank to keep it unchanged.'
			: requiresReplacementValue
				? 'Enter a replacement value before converting this secret to plain text.'
				: 'Secret values are write-only and are never displayed or copied by the app.';

	const setEnvironmentSelected = (id: string, isSelected: boolean) =>
		setSelectedEnvironmentIDs((current) => {
			const next = new Set(current);
			if (isSelected) next.add(id);
			else next.delete(id);
			return next;
		});

	const save = async () => {
		if (!payload) return;
		const trimmedKey = key.trim();
		const scopedIDs = allEnvironments ? [] : [...selectedEnvironmentIDs].sort();
		const request: VariableSaveRequest = variable
			? {
					kind: 'update',
					id: variable.id,
					request: {
						key: trimmedKey,
						value: value === '' && variable.isSecret && isSecret ? undefined : value,
						isSecret,
						allEnvironments,
						environmentIDs: scopedIDs
					}
				}
			: {
					kind: 'create',
					request: { key: trimmedKey, value, isSecret, allEnvironments, environmentIDs: scopedIDs }
				};

		setIsSaving(true);
		setErrorMessage(undefined);
		try {
			await payload.onSave(request);
			showToast(Toasts.success(isEditing ? 'Variable updated' : 'Variable created'));
			nav.back();
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsSaving(false);
		}
	};

	return {
		title: isEditing ? 'Edit Variable' : 'New Variable',
		isEditing,
		key,
		setKey,
		value,
		setValue,
		isSecret,
		setIsSecret,
		allEnvironments,
		setAllEnvironments,
		environmentOptions,
		isEnvironmentSelected: (id: string) => selectedEnvironmentIDs.has(id),
		setEnvironmentSelected,
		variableFooter,
		isSaving,
		errorMessage,
		canSave,
		save,
		cancel: nav.back
	};
}

export type VariableEditorModel = ReturnType<typeof useVariableEditor>;
