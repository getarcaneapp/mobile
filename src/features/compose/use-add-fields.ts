import { useEffect, useState } from 'react';

import { ComposeDocument } from './model/compose-document';
import { composeErrorMessage, ComposeFormError } from './model/compose-errors';
import type { ComposeFieldPathComponent } from './model/compose-native-field';
import { ComposeSchema, type ComposeSchemaField } from './model/compose-schema';
import {
	addingDraft,
	makeSettingDraft,
	prepareFields,
	type ComposeSettingDraft
} from './model/compose-setting-draft';

export type AddFieldsOptions = {
	fieldPath: ComposeFieldPathComponent[];
	excluding?: string[];
	schemaPath?: ComposeFieldPathComponent[];
	includesProjectSettings?: boolean;
	preferredService?: string;
};

const includesInsensitive = (value: string, search: string) =>
	value.toLowerCase().includes(search.toLowerCase());

export function useAddFields(
	text: string,
	setText: (text: string) => void,
	options: AddFieldsOptions
) {
	const fieldPath = options.fieldPath;
	const schemaPath = options.schemaPath ?? fieldPath;
	const excluding = new Set(options.excluding ?? []);
	const includesProjectSettings = options.includesProjectSettings ?? false;
	const document = ComposeDocument.tryParse(text);
	const services = document?.services ?? [];

	const [serviceSelection, setServiceSelection] = useState(() => {
		if (!includesProjectSettings) return '';
		const initial = ComposeDocument.tryParse(text)?.services ?? [];
		const preferred = options.preferredService;
		return preferred !== undefined && initial.includes(preferred) ? preferred : (initial[0] ?? '');
	});
	const [newServiceName, setNewServiceName] = useState('');
	const [selectionIsProject, setSelectionIsProject] = useState(false);
	const [search, setSearch] = useState('');
	const [draft, setDraft] = useState<ComposeSettingDraft>();
	const [needsName, setNeedsName] = useState(false);
	const [error, setError] = useState<string>();

	const serviceName = serviceSelection === '' ? newServiceName.trim() : serviceSelection;
	const servicePath: ComposeFieldPathComponent[] = [
		{ key: 'services' },
		{ key: serviceName === '' ? 'new-service' : serviceName }
	];
	const destinationPath = includesProjectSettings
		? selectionIsProject
			? []
			: servicePath
		: fieldPath;
	const isList = !includesProjectSettings && document?.nativeField(fieldPath).kind === 'sequence';

	const suggestions = (
		path: ComposeFieldPathComponent[],
		schema: ComposeFieldPathComponent[],
		excluded: Set<string>
	): ComposeSchemaField[] => {
		const existing = new Set((document?.nativeFields(path) ?? []).map((field) => field.name));
		return ComposeSchema.fields(schema).filter(
			(field) =>
				!existing.has(field.name) &&
				!excluded.has(field.name) &&
				(search === '' ||
					includesInsensitive(field.name, search) ||
					includesInsensitive(field.description, search))
		);
	};
	const available = suggestions(
		includesProjectSettings ? servicePath : fieldPath,
		includesProjectSettings ? servicePath : schemaPath,
		excluding
	);
	const projectFields = includesProjectSettings ? suggestions([], [], new Set(['services'])) : [];

	const select = (field: ComposeSchemaField | undefined, project = false) => {
		if (includesProjectSettings && !project && serviceSelection === '') {
			if (serviceName === '') {
				setError('Enter a service name above.');
				return;
			}
			if (services.includes(serviceName)) {
				setError('A service with this name already exists.');
				return;
			}
		}
		setSelectionIsProject(project);
		setNeedsName(field === undefined && !isList);
		const base = includesProjectSettings ? (project ? [] : servicePath) : schemaPath;
		const itemIndex = ComposeDocument.tryParse(text)?.nativeFields(fieldPath).length ?? 0;
		const path: ComposeFieldPathComponent[] = [
			...base,
			isList ? { index: itemIndex } : { key: field?.name ?? 'custom-setting' }
		];
		const pending = prepareFields(
			makeSettingDraft(isList ? 'Item' : (field?.name ?? ''), path, true)
		);
		setError(undefined);
		setDraft(pending);
	};

	useEffect(() => {
		if (isList && draft === undefined) select(ComposeSchema.value([...schemaPath, { index: 0 }]));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const add = (pending: ComposeSettingDraft): string | undefined => {
		try {
			if (excluding.has(pending.name))
				throw ComposeFormError.invalid('This setting is managed outside this editor.');
			if (includesProjectSettings && selectionIsProject && pending.name === 'services') {
				throw ComposeFormError.invalid('Use the service settings above to add a service.');
			}
			const newService =
				includesProjectSettings && !selectionIsProject && serviceSelection === ''
					? serviceName
					: undefined;
			const result = addingDraft(pending, text, destinationPath, newService, isList);
			setText(result);
			if (newService !== undefined) setServiceSelection(newService);
			return undefined;
		} catch (caught) {
			return composeErrorMessage(caught);
		}
	};

	return {
		includesProjectSettings,
		services,
		serviceSelection,
		setServiceSelection,
		newServiceName,
		setNewServiceName,
		search,
		setSearch,
		draft,
		setDraft,
		needsName,
		error,
		isList,
		available,
		projectFields,
		select,
		add
	};
}

export type AddFieldsModel = ReturnType<typeof useAddFields>;
