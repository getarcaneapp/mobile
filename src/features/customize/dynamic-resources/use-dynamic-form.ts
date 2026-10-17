import { useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { useSettingsNavigation } from '@/features/settings/shared/settings-routes';

import { formBody, jsonDisplayString, type BackendFormField } from './dynamic-resource';
import { useRoutePayload, type DynamicFormPayload } from './dynamic-resource-routes';

function initialState(payload: DynamicFormPayload | undefined) {
	const values: Record<string, string> = {};
	const toggles: Record<string, boolean> = {};
	for (const field of payload?.fields ?? []) {
		const current = payload?.initial?.values[field.id];
		switch (field.type.kind) {
			case 'toggle':
				toggles[field.id] = typeof current === 'boolean' ? current : false;
				break;
			case 'secure':
				break;
			case 'choice':
				values[field.id] = typeof current === 'string' ? current : (field.type.options[0] ?? '');
				break;
			default:
				if (current !== undefined && current !== null)
					values[field.id] = jsonDisplayString(current);
		}
	}
	return { values, toggles };
}

export function useDynamicForm() {
	const nav = useSettingsNavigation();
	const payload = useRoutePayload<DynamicFormPayload>();
	const [state, setState] = useState(() => initialState(payload));
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	const fields = payload?.fields ?? [];
	const isEditing = payload?.initial !== undefined;

	const canSave =
		isEditing ||
		fields.every(
			(field) =>
				!field.required ||
				field.type.kind === 'toggle' ||
				(state.values[field.id] ?? '').trim() !== ''
		);

	const placeholder = (field: BackendFormField, fallback: string) => {
		if (isEditing && payload?.initial?.values[field.id] === undefined)
			return 'Leave blank to keep current value';
		return field.placeholder === '' ? fallback : field.placeholder;
	};

	const save = async () => {
		if (!payload) return;
		setIsSaving(true);
		setErrorMessage(undefined);
		try {
			await payload.onSubmit(formBody(state.values, state.toggles, fields));
			nav.back();
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsSaving(false);
		}
	};

	return {
		title: payload?.title ?? '',
		fields,
		value: (id: string) => state.values[id] ?? '',
		setValue: (id: string, text: string) =>
			setState((s) => ({ ...s, values: { ...s.values, [id]: text } })),
		toggle: (id: string) => state.toggles[id] ?? false,
		setToggle: (id: string, isOn: boolean) =>
			setState((s) => ({ ...s, toggles: { ...s.toggles, [id]: isOn } })),
		placeholder,
		isSaving,
		errorMessage,
		saveDisabled: isSaving || !canSave,
		save,
		cancel: nav.back
	};
}

export type DynamicFormModel = ReturnType<typeof useDynamicForm>;
