import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import { hasPermission } from '@/core/auth/permissions';
import { M3Section, SwitchRow } from '@/features/containers/android-material';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import { Permission } from '@/sdk/models/role/Permission';
import { useClientManager } from '@/stores/client-manager';
import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { ListUX } from '@/ui/components/paginated-list.types';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { entryWrapper, rawFromWrapper, validName } from './compose-actions';
import {
	ChoiceRow,
	EmptyRow,
	ErrorText,
	FullScreenDialog,
	InlineInput,
	NavRow,
	ripple,
	SecondaryText,
	TextAction,
	type Choice
} from './compose-android-kit';
import { makeSessionID, useComposeSessionHost } from './compose-session';
import { ComposeDisplayText } from './model/compose-display-text';
import { ComposeEntryDraft, type ComposeEntryKind } from './model/compose-entry-draft';
import { composeErrorMessage } from './model/compose-errors';
import { ComposeFieldOptions } from './model/compose-field-options';
import {
	editableNativeKinds,
	nativeKindTitle,
	type ComposeFieldPathComponent,
	type ComposeNativeKind
} from './model/compose-native-field';
import {
	appendEntry,
	draftFields,
	draftSchema,
	prepareFields,
	type ComposeSettingDraft
} from './model/compose-setting-draft';
import type { ComposeSchemaField } from './model/compose-schema';
import { useAddFields, type AddFieldsOptions } from './use-add-fields';

export function NameSheet({
	visible,
	title,
	placeholder,
	onClose,
	save
}: {
	visible: boolean;
	title: string;
	placeholder: string;
	onClose: () => void;
	save: (name: string) => string | undefined;
}) {
	const [name, setName] = useState('');
	const [error, setError] = useState<string>();
	useEffect(() => {
		if (visible) {
			setName('');
			setError(undefined);
		}
	}, [visible]);
	return (
		<FullScreenDialog
			visible={visible}
			title={title}
			onClose={onClose}
			confirmTitle="Add"
			confirmDisabled={!validName(name)}
			onConfirm={() => {
				const result = save(name);
				setError(result);
				if (result === undefined) onClose();
			}}
		>
			<M3Section>
				<InlineInput value={name} onChangeText={setName} placeholder={placeholder} autoFocus />
				<ErrorText error={error} />
			</M3Section>
		</FullScreenDialog>
	);
}

export function NativeValueSheet({
	title,
	kind: initialKind,
	value: initialValue,
	needsName,
	onClose,
	save
}: {
	title: string;
	kind: ComposeNativeKind;
	value: string;
	needsName: boolean;
	onClose: () => void;
	save: (name: string, kind: ComposeNativeKind, value: string) => string | undefined;
}) {
	const [name, setName] = useState('');
	const [kind, setKind] = useState(initialKind);
	const [value, setValue] = useState(initialValue);
	const [error, setError] = useState<string>();
	return (
		<FullScreenDialog
			visible
			title={ComposeDisplayText.title(title)}
			onClose={onClose}
			confirmTitle="Apply"
			confirmDisabled={needsName && name === ''}
			onConfirm={() => {
				const result = save(name, kind, value);
				setError(result);
				if (result === undefined) onClose();
			}}
		>
			<M3Section>
				{needsName ? <InlineInput value={name} onChangeText={setName} placeholder="Name" /> : null}
				{needsName || kind === 'null' ? (
					<ChoiceRow
						title="Type"
						selection={kind}
						choices={editableNativeKinds.map((k) => ({ value: k, label: nativeKindTitle[k] }))}
						onSelect={(next) => setKind(next as ComposeNativeKind)}
					/>
				) : null}
				{kind === 'string' ? (
					<InlineInput value={value} onChangeText={setValue} placeholder="Value" multiline />
				) : null}
				{kind === 'number' ? (
					<InlineInput
						value={value}
						onChangeText={setValue}
						placeholder="Value"
						keyboardType="numbers-and-punctuation"
					/>
				) : null}
				{kind === 'boolean' ? (
					<SwitchRow
						title="Enabled"
						value={value.toLowerCase() === 'true'}
						onValueChange={(on) => setValue(String(on))}
					/>
				) : null}
				{kind === 'mapping' ? (
					<SecondaryText>Add fields after creating this object.</SecondaryText>
				) : null}
				{kind === 'sequence' ? (
					<SecondaryText>Add items after creating this list.</SecondaryText>
				) : null}
				{kind === 'null' ? <SecondaryText>Store an empty value.</SecondaryText> : null}
				<ErrorText error={error} />
			</M3Section>
		</FullScreenDialog>
	);
}

export function ValuePicker({
	title,
	options,
	value,
	onChange,
	disabled
}: {
	title: string;
	options: ComposeFieldOptions;
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
}) {
	const [custom, setCustom] = useState(false);
	const isCustom = custom || (value !== '' && !options.values.includes(value));
	const choices: Choice[] = [
		{ value: '', label: 'Choose…' },
		...options.values.map((v) => ({ value: v, label: options.label(v) }))
	];
	if (options.allowsCustom) choices.push({ value: '__custom__', label: 'Custom value…' });
	else if (value !== '' && !options.values.includes(value))
		choices.push({ value: '__custom__', label: value });
	return (
		<>
			<ChoiceRow
				title={title}
				selection={isCustom ? '__custom__' : value}
				choices={choices}
				disabled={disabled}
				onSelect={(selection) => {
					const nextCustom = selection === '__custom__';
					setCustom(nextCustom);
					if (!nextCustom) onChange(selection);
					else if (options.values.includes(value)) onChange('');
				}}
			/>
			{options.allowsCustom && isCustom ? (
				<InlineInput
					value={value}
					onChangeText={onChange}
					placeholder="Custom value or ${VARIABLE}"
					editable={!disabled}
				/>
			) : null}
		</>
	);
}

function formatName(draft: ComposeSettingDraft, kind: ComposeNativeKind) {
	switch (kind) {
		case 'mapping':
			return draftFields(draft).length === 0 ? 'Name and value pairs' : 'Fill in fields';
		case 'sequence':
			return 'List of values';
		case 'boolean':
			return 'On or off';
		case 'string':
			return 'Text or variable';
		case 'null':
			return 'No value';
		default:
			return nativeKindTitle[kind];
	}
}

function placeholderFor(name: string) {
	switch (name) {
		case 'icon':
		case 'icons':
		case 'icon-light':
		case 'icon-dark':
			return 'Icon name or image URL';
		case 'urls':
			return 'https://example.com';
		default:
			return 'Value';
	}
}

function descriptionFor(draft: ComposeSettingDraft) {
	switch (draft.name) {
		case 'annotations':
			return 'Add names and values for tools that use this service.';
		case 'x-arcane':
			return 'Choose how this appears in Arcane. Fill in only the settings you need.';
		case 'labels':
			return 'Add labels as names and values.';
		default:
			return draftSchema(draft)?.description;
	}
}

function SettingFields({
	draft,
	onChange,
	root = false,
	namedEntry = false,
	onRemove
}: {
	draft: ComposeSettingDraft;
	onChange: (draft: ComposeSettingDraft) => void;
	root?: boolean;
	namedEntry?: boolean;
	onRemove?: () => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const title = draft.name === '' ? 'Value' : ComposeDisplayText.title(draft.name);
	const choices = draftSchema(draft)?.kinds ?? editableNativeKinds;
	const options = new ComposeFieldOptions(draft.schemaPath);
	const collection = draft.kind === 'mapping' || draft.kind === 'sequence';
	const fieldsEmpty = draftFields(draft).length === 0;

	const formatPicker =
		choices.length > 1 ? (
			<ChoiceRow
				title="Enter as"
				selection={draft.kind}
				choices={choices.map((kind) => ({ value: kind, label: formatName(draft, kind) }))}
				onSelect={(kind) =>
					onChange(
						prepareFields({
							...draft,
							kind: kind as ComposeNativeKind,
							value: '',
							children: [],
							included: false
						})
					)
				}
			/>
		) : null;

	const removeButton = onRemove ? (
		<Pressable
			onPress={onRemove}
			accessibilityRole="button"
			accessibilityLabel="Delete"
			style={{ padding: 12 }}
		>
			<Icon name="trash" size={18} color={m3.error} />
		</Pressable>
	) : null;

	const updateChild = (index: number, child: ComposeSettingDraft) =>
		onChange({ ...draft, children: draft.children.map((c, i) => (i === index ? child : c)) });
	const removeChild = (index: number) =>
		onChange({ ...draft, children: draft.children.filter((_, i) => i !== index) });

	const contents = (
		<>
			{root && descriptionFor(draft) ? (
				<SecondaryText>{descriptionFor(draft)}</SecondaryText>
			) : null}
			{formatPicker}
			{namedEntry ? (
				<InlineInput
					title="Name"
					value={draft.name}
					onChangeText={(name) =>
						onChange({ ...draft, name, included: name !== '' || draft.value !== '' })
					}
				/>
			) : null}
			{draft.kind === 'mapping' ? (
				<>
					{draft.children.map((child, index) => (
						<SettingFields
							key={child.id}
							draft={child}
							namedEntry={fieldsEmpty}
							onChange={(next) => updateChild(index, next)}
							onRemove={fieldsEmpty ? () => removeChild(index) : undefined}
						/>
					))}
					{fieldsEmpty ? (
						<TextAction
							title="Add entry"
							icon="plus"
							onPress={() => onChange(appendEntry(draft))}
						/>
					) : null}
				</>
			) : null}
			{draft.kind === 'sequence' ? (
				<>
					{draft.children.map((child, index) => (
						<SettingFields
							key={child.id}
							draft={child}
							root
							onChange={(next) => updateChild(index, next)}
							onRemove={() => removeChild(index)}
						/>
					))}
					<TextAction title="Add item" icon="plus" onPress={() => onChange(appendEntry(draft))} />
				</>
			) : null}
			{draft.kind === 'boolean' ? (
				<SwitchRow
					title={title}
					value={draft.value === 'true'}
					onValueChange={(enabled) =>
						onChange({ ...draft, value: String(enabled), included: true })
					}
				/>
			) : null}
			{draft.kind === 'string' || draft.kind === 'number' ? (
				options.values.length > 0 ? (
					<ValuePicker
						title={title}
						options={options}
						value={draft.value}
						onChange={(value) => onChange({ ...draft, value, included: value !== '' })}
					/>
				) : (
					<InlineInput
						title={namedEntry ? 'Value' : title}
						value={draft.value}
						placeholder={placeholderFor(draft.name)}
						keyboardType={draft.kind === 'number' ? 'numbers-and-punctuation' : 'default'}
						onChangeText={(value) =>
							onChange({
								...draft,
								value,
								included: namedEntry ? draft.name !== '' || value !== '' : value !== ''
							})
						}
					/>
				)
			) : null}
			{draft.kind === 'null' ? <SecondaryText>Leave this setting empty.</SecondaryText> : null}
			{draft.kind === 'unsupported' ? (
				<SecondaryText>This value can't be edited here.</SecondaryText>
			) : null}
		</>
	);

	if (!root && collection && !namedEntry) {
		return (
			<View>
				<Pressable
					onPress={() => {
						if (!expanded) onChange(prepareFields(draft));
						setExpanded(!expanded);
					}}
					android_ripple={ripple}
					accessibilityRole="button"
					accessibilityState={{ expanded }}
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						minHeight: 56,
						paddingHorizontal: 16
					}}
				>
					<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{title}</Text>
					{removeButton}
					<Icon
						name={expanded ? 'chevron.up' : 'chevron.down'}
						size={20}
						color={colors.secondaryLabel}
					/>
				</Pressable>
				{expanded ? <View style={{ paddingLeft: 16 }}>{contents}</View> : null}
			</View>
		);
	}
	if (
		namedEntry &&
		(draft.kind === 'string' || draft.kind === 'number') &&
		options.values.length === 0
	) {
		const update = (name: string, value: string) =>
			onChange({ ...draft, name, value, included: name !== '' || value !== '' });
		return (
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					paddingLeft: 16,
					minHeight: 56,
					gap: 8
				}}
			>
				<TextInput
					value={draft.name}
					onChangeText={(name) => update(name, draft.value)}
					placeholder="Name"
					placeholderTextColor={colors.tertiaryLabel as string}
					accessibilityLabel="Name"
					autoCapitalize="none"
					autoCorrect={false}
					style={[m3Type.bodyLarge, { flex: 1, color: colors.label }]}
				/>
				<TextInput
					value={draft.value}
					onChangeText={(value) => update(draft.name, value)}
					placeholder="Value"
					placeholderTextColor={colors.tertiaryLabel as string}
					accessibilityLabel="Value"
					autoCapitalize="none"
					autoCorrect={false}
					style={[m3Type.bodyLarge, { flex: 1, color: colors.label, textAlign: 'right' }]}
				/>
				{removeButton}
			</View>
		);
	}
	return (
		<View>
			{removeButton ? <View style={{ alignItems: 'flex-end' }}>{removeButton}</View> : null}
			{contents}
		</View>
	);
}

export function SettingEditor({
	draft: initial,
	needsName,
	onClose,
	save
}: {
	draft: ComposeSettingDraft;
	needsName: boolean;
	onClose: () => void;
	save: (draft: ComposeSettingDraft) => string | undefined;
}) {
	const [draft, setDraft] = useState(initial);
	const [error, setError] = useState<string>();
	return (
		<FullScreenDialog
			visible
			title={needsName ? 'New setting' : ComposeDisplayText.title(draft.name)}
			onClose={onClose}
			confirmTitle="Add"
			confirmDisabled={needsName && draft.name.trim() === ''}
			onConfirm={() => {
				const result = save(draft);
				setError(result);
				if (result === undefined) onClose();
			}}
		>
			{needsName ? (
				<M3Section>
					<InlineInput
						value={draft.name}
						onChangeText={(name) => setDraft({ ...draft, name })}
						placeholder="Setting name"
					/>
				</M3Section>
			) : null}
			<M3Section>
				<SettingFields draft={draft} onChange={setDraft} root />
			</M3Section>
			{error ? (
				<M3Section>
					<ErrorText error={error} />
				</M3Section>
			) : null}
		</FullScreenDialog>
	);
}

function FieldButton({ field, onPress }: { field: ComposeSchemaField; onPress: () => void }) {
	return (
		<NavRow
			title={ComposeDisplayText.title(field.name)}
			subtitle={field.description === '' ? undefined : field.description}
			onPress={onPress}
			chevron={false}
		/>
	);
}

function AddFieldsContent({
	text,
	setText,
	options,
	onClose
}: {
	text: string;
	setText: (text: string) => void;
	options: AddFieldsOptions;
	onClose: () => void;
}) {
	const model = useAddFields(text, setText, options);
	const editor = model.draft ? (
		<SettingEditor
			key={model.draft.id}
			draft={model.draft}
			needsName={model.needsName}
			onClose={() => {
				model.setDraft(undefined);
				if (model.isList) onClose();
			}}
			save={model.add}
		/>
	) : null;
	if (model.isList) return editor;
	return (
		<>
			<FullScreenDialog visible title="Add configuration" onClose={onClose}>
				<View
					style={{
						margin: 16,
						marginBottom: 0,
						flexDirection: 'row',
						alignItems: 'center',
						gap: 12,
						borderRadius: 28,
						paddingHorizontal: 16,
						minHeight: 56,
						backgroundColor: m3.surfaceContainerHigh
					}}
				>
					<Icon name="magnifyingglass" size={22} color={m3.onSurfaceVariant} />
					<TextInput
						value={model.search}
						onChangeText={model.setSearch}
						placeholder="Find a Compose setting"
						placeholderTextColor={m3.onSurfaceVariant as string}
						autoCapitalize="none"
						autoCorrect={false}
						style={[m3Type.bodyLarge, { flex: 1, color: colors.label }]}
					/>
				</View>
				{model.includesProjectSettings ? (
					<>
						<M3Section
							footer={
								model.serviceSelection === ''
									? 'Enter a name, then choose a setting below to create the service.'
									: undefined
							}
						>
							{model.services.length > 0 ? (
								<ChoiceRow
									title="Service"
									selection={model.serviceSelection}
									choices={[
										...model.services.map((s) => ({ value: s, label: s })),
										{ value: '', label: 'New service' }
									]}
									onSelect={model.setServiceSelection}
								/>
							) : null}
							{model.serviceSelection === '' ? (
								<InlineInput
									value={model.newServiceName}
									onChangeText={model.setNewServiceName}
									placeholder="Service name"
								/>
							) : null}
							<ErrorText error={model.error} />
						</M3Section>
						<M3Section title="Service settings">
							{model.available.map((field) => (
								<FieldButton key={field.name} field={field} onPress={() => model.select(field)} />
							))}
							<TextAction
								title="Custom service field"
								icon="plus"
								onPress={() => model.select(undefined)}
							/>
						</M3Section>
						<M3Section title="Project settings">
							{model.projectFields.map((field) => (
								<FieldButton
									key={field.name}
									field={field}
									onPress={() => model.select(field, true)}
								/>
							))}
							<TextAction
								title="Custom project field"
								icon="plus"
								onPress={() => model.select(undefined, true)}
							/>
						</M3Section>
					</>
				) : (
					<M3Section>
						{model.available.map((field) => (
							<FieldButton key={field.name} field={field} onPress={() => model.select(field)} />
						))}
						<TextAction title="Custom field" icon="plus" onPress={() => model.select(undefined)} />
					</M3Section>
				)}
			</FullScreenDialog>
			{editor}
		</>
	);
}

export function AddFieldsSheet(props: {
	visible: boolean;
	text: string;
	setText: (text: string) => void;
	options: AddFieldsOptions;
	onClose: () => void;
}) {
	if (!props.visible) return null;
	return (
		<AddFieldsContent
			text={props.text}
			setText={props.setText}
			options={props.options}
			onClose={props.onClose}
		/>
	);
}

async function fetchResourceNamePage(
	client: ArcaneClient,
	isVolume: boolean,
	environmentID: EnvironmentID,
	query: string,
	start: number
) {
	const page = {
		search: query === '' ? undefined : query,
		start,
		limit: ListUX.pageSizeDefault,
		sortBy: 'name',
		sortOrder: 'asc' as const
	};
	const response = isVolume
		? await client.volumes.list({ envID: environmentID, query: page })
		: await client.networks.list({ envID: environmentID, query: page });
	return {
		names: response.data.map((item) => item.name),
		hasMore: start + response.data.length < response.pagination.totalItems
	};
}

function appendUniqueNames(current: string[], incoming: string[], reset: boolean) {
	const base = reset ? [] : current;
	const existing = new Set(base);
	return [...base, ...incoming.filter((name) => !existing.has(name) && existing.add(name))];
}

export function ResourcePicker({
	kind,
	selection,
	onSelect,
	onClose
}: {
	kind: ComposeEntryKind;
	selection: string;
	onSelect: (name: string) => void;
	onClose: () => void;
}) {
	const isVolume = kind === 'mount';
	const environmentID = useClientManager((s) => s.activeEnvironmentID);
	const canList = useClientManager(
		() =>
			(kind === 'mount' || kind === 'network') &&
			hasPermission(isVolume ? Permission.Volumes.list : Permission.Networks.list, environmentID)
	);
	const [search, setSearch] = useState('');
	const [names, setNames] = useState<string[]>([]);
	const [hasMore, setHasMore] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [generation, setGeneration] = useState(0);

	const load = async (reset: boolean, query: string, start: number) => {
		const client = useClientManager.getState().client;
		if (!canList || !client) return;
		setIsLoading(true);
		setErrorMessage(undefined);
		await withCleanup(
			async () => {
				try {
					const page = await fetchResourceNamePage(client, isVolume, environmentID, query, start);
					setNames((current) => appendUniqueNames(current, page.names, reset));
					setHasMore(page.hasMore);
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => setIsLoading(false)
		);
	};

	const loadTask = useEffectEvent((query: string) => () => void load(true, query, 0));

	useEffect(() => {
		setNames([]);
		setHasMore(false);
		setErrorMessage(undefined);
		if (!canList) return;
		const timer = setTimeout(loadTask(search), ListUX.searchDebounce);
		return () => clearTimeout(timer);
	}, [search, canList, environmentID, generation]);

	return (
		<FullScreenDialog
			visible
			title={isVolume ? 'Choose Volume' : 'Choose Network'}
			onClose={onClose}
		>
			<View
				style={{
					margin: 16,
					marginBottom: 0,
					flexDirection: 'row',
					alignItems: 'center',
					gap: 12,
					borderRadius: 28,
					paddingHorizontal: 16,
					minHeight: 56,
					backgroundColor: m3.surfaceContainerHigh
				}}
			>
				<Icon name="magnifyingglass" size={22} color={m3.onSurfaceVariant} />
				<TextInput
					value={search}
					onChangeText={setSearch}
					placeholder="Search names"
					placeholderTextColor={m3.onSurfaceVariant as string}
					autoCapitalize="none"
					autoCorrect={false}
					style={[m3Type.bodyLarge, { flex: 1, color: colors.label }]}
				/>
			</View>
			<M3Section>
				<SecondaryText>
					The selected resource will be declared external when you apply this entry.
				</SecondaryText>
			</M3Section>
			<M3Section>
				{!canList ? (
					<EmptyRow
						icon="lock.fill"
						title="Listing Access Required"
						description="You can close this picker and enter a name manually."
					/>
				) : (
					<>
						{names.map((name) => (
							<NavRow
								key={name}
								title={name}
								icon={isVolume ? 'externaldrive' : 'network'}
								chevron={false}
								value={name === selection ? '✓' : undefined}
								onPress={() => {
									onSelect(name);
									onClose();
								}}
							/>
						))}
						{isLoading ? (
							<View style={{ padding: 16, alignItems: 'center' }}>
								<ActivityIndicator accessibilityLabel="Loading…" />
							</View>
						) : errorMessage !== undefined ? (
							<>
								<ErrorText error={errorMessage} />
								<TextAction
									title="Try Again"
									onPress={() =>
										names.length === 0
											? setGeneration((g) => g + 1)
											: void load(false, search, names.length)
									}
								/>
							</>
						) : names.length === 0 ? (
							<EmptyRow
								icon="magnifyingglass"
								title={search === '' ? 'No Results' : `No Results for "${search}"`}
								description="Check the spelling or try a new search."
							/>
						) : hasMore ? (
							<TextAction
								title="Load More"
								onPress={() => void load(false, search, names.length)}
							/>
						) : null}
					</>
				)}
			</M3Section>
		</FullScreenDialog>
	);
}

export type NativeFieldsRenderer = (props: {
	session: string;
	schemaPath: ComposeFieldPathComponent[];
}) => ReactNode;

function EntrySettingsDialog({
	wrapper,
	setWrapper,
	schemaPath,
	onDone,
	renderNativeFields
}: {
	wrapper: string;
	setWrapper: (text: string) => void;
	schemaPath: ComposeFieldPathComponent[];
	onDone: () => void;
	renderNativeFields: NativeFieldsRenderer;
}) {
	const [session] = useState(() => makeSessionID('entry'));
	useComposeSessionHost(session, wrapper, setWrapper);
	return (
		<FullScreenDialog
			visible
			title="Entry settings"
			onClose={onDone}
			confirmTitle="Done"
			onConfirm={onDone}
			scrolls={false}
		>
			{renderNativeFields({ session, schemaPath })}
		</FullScreenDialog>
	);
}

function entryDraftRaw(
	supported: boolean,
	draft: ComposeEntryDraft,
	kind: ComposeEntryKind,
	nativeSource: string
) {
	return supported ? draft.yaml(kind) : nativeSource;
}

function saveEntryDraft(
	supported: boolean,
	draft: ComposeEntryDraft,
	kind: ComposeEntryKind,
	nativeSource: string,
	externalResource: string | undefined,
	save: (raw: string, externalResource: string | undefined) => string | undefined
) {
	const raw = entryDraftRaw(supported, draft, kind, nativeSource);
	return save(raw, supported && externalResource === draft.source ? externalResource : undefined);
}

export function EntrySheet({
	kind,
	original,
	schemaPath,
	onClose,
	save,
	renderNativeFields
}: {
	kind: ComposeEntryKind;
	original: string;
	schemaPath: ComposeFieldPathComponent[];
	onClose: () => void;
	save: (raw: string, externalResource: string | undefined) => string | undefined;
	renderNativeFields: NativeFieldsRenderer;
}) {
	const [initial] = useState(() => {
		try {
			return { draft: new ComposeEntryDraft(original, kind), supported: true };
		} catch {
			return { draft: new ComposeEntryDraft(), supported: false };
		}
	});
	const [draft, setDraft] = useState(initial.draft);
	const [supported, setSupported] = useState(initial.supported);
	const [error, setError] = useState<string>();
	const [reveal, setReveal] = useState(false);
	const [showResources, setShowResources] = useState(false);
	const [externalResource, setExternalResource] = useState<string>();
	const [nativeSource, setNativeSource] = useState(original);
	const [nativeWrapper, setNativeWrapper] = useState<string>();

	const update = (
		changes: Partial<
			Pick<ComposeEntryDraft, 'source' | 'target' | 'address' | 'option' | 'readOnly'>
		>
	) => setDraft(draft.with(changes));

	const applyNativeSettings = (wrapper: string) => {
		try {
			const raw = rawFromWrapper(wrapper);
			setNativeSource(raw);
			try {
				setDraft(new ComposeEntryDraft(raw, kind));
				setSupported(true);
			} catch {
				setSupported(false);
			}
			setExternalResource(undefined);
			setError(undefined);
		} catch (caught) {
			setError(composeErrorMessage(caught));
		}
	};

	const resourceButton = (
		<>
			<TextAction title="Choose existing resource" onPress={() => setShowResources(true)} />
			{externalResource !== undefined && externalResource === draft.source ? (
				<Text
					style={[
						m3Type.bodySmall,
						{ color: colors.secondaryLabel, paddingHorizontal: 16, paddingBottom: 12 }
					]}
				>
					This resource will be declared external in the Compose file.
				</Text>
			) : null}
		</>
	);

	return (
		<>
			<FullScreenDialog
				visible
				title={original === '' ? 'Add entry' : 'Edit entry'}
				onClose={onClose}
				confirmTitle="Apply"
				confirmDisabled={!supported && nativeSource === ''}
				onConfirm={() => {
					try {
						const result = saveEntryDraft(
							supported,
							draft,
							kind,
							nativeSource,
							externalResource,
							save
						);
						setError(result);
						if (result === undefined) onClose();
					} catch (caught) {
						setError(composeErrorMessage(caught));
					}
				}}
			>
				<M3Section>
					{!supported ? <SecondaryText>Unsupported format</SecondaryText> : null}
					{supported && kind === 'port' ? (
						<>
							<InlineInput
								title="Host address (optional)"
								placeholder="Host address"
								value={draft.address}
								onChangeText={(address) => update({ address })}
								autoFocus
							/>
							<InlineInput
								title="Host port (optional)"
								placeholder="Host port"
								value={draft.source}
								onChangeText={(source) => update({ source })}
								keyboardType="numbers-and-punctuation"
							/>
							<InlineInput
								title="Container port"
								value={draft.target}
								onChangeText={(target) => update({ target })}
								keyboardType="numbers-and-punctuation"
							/>
							<ChoiceRow
								title="Protocol"
								selection={draft.option}
								choices={[
									{ value: 'tcp', label: 'TCP' },
									{ value: 'udp', label: 'UDP' },
									{ value: 'sctp', label: 'SCTP' }
								]}
								onSelect={(option) => update({ option })}
							/>
						</>
					) : null}
					{supported && kind === 'mount' ? (
						<>
							<InlineInput
								title="Volume name or host path (optional)"
								placeholder="Volume name or host path"
								value={draft.source}
								onChangeText={(source) => update({ source })}
								autoFocus
							/>
							<InlineInput
								title="Container path"
								value={draft.target}
								onChangeText={(target) => update({ target })}
							/>
							<SwitchRow
								title="Read only"
								value={draft.readOnly}
								onValueChange={(readOnly) => update({ readOnly })}
							/>
							{resourceButton}
						</>
					) : null}
					{supported && kind === 'keyValue' ? (
						<>
							<InlineInput
								title="Name"
								value={draft.source}
								onChangeText={(source) => update({ source })}
								autoFocus
							/>
							<InlineInput
								title="Value"
								value={draft.target}
								onChangeText={(target) => update({ target })}
								secure={!reveal}
							/>
							<SwitchRow title="Reveal value" value={reveal} onValueChange={setReveal} />
						</>
					) : null}
					{supported && kind === 'network' ? (
						<>
							<InlineInput
								title="Network name"
								value={draft.source}
								onChangeText={(source) => update({ source })}
								autoFocus
							/>
							{resourceButton}
						</>
					) : null}
					{kind === 'port' || kind === 'mount' ? (
						<TextAction
							title="All settings"
							onPress={() => {
								try {
									const raw = entryDraftRaw(supported, draft, kind, nativeSource);
									setNativeSource(raw);
									setNativeWrapper(entryWrapper(raw));
								} catch (caught) {
									setError(composeErrorMessage(caught));
								}
							}}
						/>
					) : null}
					<ErrorText error={error} />
				</M3Section>
			</FullScreenDialog>
			{nativeWrapper !== undefined ? (
				<EntrySettingsDialog
					wrapper={nativeWrapper}
					setWrapper={setNativeWrapper}
					schemaPath={schemaPath}
					renderNativeFields={renderNativeFields}
					onDone={() => {
						applyNativeSettings(nativeWrapper);
						setNativeWrapper(undefined);
					}}
				/>
			) : null}
			{showResources ? (
				<ResourcePicker
					kind={kind}
					selection={draft.source}
					onClose={() => setShowResources(false)}
					onSelect={(name) => {
						update({ source: name });
						setExternalResource(name);
					}}
				/>
			) : null}
		</>
	);
}
