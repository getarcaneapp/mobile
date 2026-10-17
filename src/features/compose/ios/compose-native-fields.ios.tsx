/**
 * Ports of `ComposeNativeFieldsForm` + `ComposeNativeValueSheet`
 * (ComposeNativeFieldsForm.swift), `ComposeAddFieldsSheet`
 * (ComposeAddFieldsSheet.swift) and `ComposeSettingEditor` +
 * `ComposeSettingFields` (ComposeSettingEditor.swift).
 *
 * SwiftUI-tree.
 */
import {
	Button,
	ContextMenu,
	DisclosureGroup,
	Form,
	HStack,
	LabeledContent,
	List,
	NavigationStack,
	Picker,
	Section,
	Spacer,
	Text,
	Toggle,
	Toolbar,
	ToolbarItem,
	VStack,
	useNativeState
} from '@expo/ui/swift-ui';
import {
	accessibilityLabel,
	buttonStyle,
	disabled,
	font,
	foregroundStyle,
	keyboardType,
	lineLimit,
	multilineTextAlignment,
	navigationBarTitleDisplayMode,
	navigationTitle,
	padding,
	presentationDetents,
	presentationDragIndicator,
	searchable,
	tag,
	textFieldStyle
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';

import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';

import { editsInline, removingNativeFields, savingNativeField } from '../compose-actions';
import type { ComposeDestination } from '../compose-destinations';
import { useComposeBinding, type ComposeBindingRef } from '../compose-session';
import { useAddFields } from '../use-add-fields';
import { ComposeDisplayText } from '../model/compose-display-text';
import { ComposeDocument } from '../model/compose-document';
import { composeErrorMessage } from '../model/compose-errors';
import { ComposeFieldOptions } from '../model/compose-field-options';
import {
	editableNativeKinds,
	nativeKindTitle,
	pathID,
	type ComposeFieldPathComponent,
	type ComposeNativeField,
	type ComposeNativeKind
} from '../model/compose-native-field';
import type { ComposeSchemaField } from '../model/compose-schema';
import {
	appendEntry,
	draftFields,
	draftSchema,
	prepareFields,
	type ComposeSettingDraft
} from '../model/compose-setting-draft';
import { ComposeValuePicker } from './compose-forms.ios';
import {
	RowsForEach,
	MenuPicker,
	BoundField,
	ComposeLink,
	EllipsisMenu,
	ErrorText,
	plainTextInput,
	secondaryStyle,
	Sheet
} from './compose-ui.ios';

type NativeFieldsDestination = Extract<ComposeDestination, { screen: 'nativeFields' }>;

// MARK: - ComposeNativeFieldsForm

/** Native access to ordinary Compose fields, including nested objects and lists. */
export function ComposeNativeFieldsForm({ destination }: { destination: NativeFieldsDestination }) {
	const { binding: bindingRef, fieldPath, schemaPath, title, readOnly } = destination;
	const binding = useComposeBinding(bindingRef);
	const [editing, setEditing] = useState<ComposeNativeField>();
	const [simpleEditing, setSimpleEditing] = useState<ComposeNativeField>();
	const [simpleValue, setSimpleValue] = useState('');
	const [adding, setAdding] = useState(false);
	const [error, setError] = useState<string>();
	const excluded = new Set(destination.excluding);
	const document = ComposeDocument.tryParse(binding.text);
	const current = document?.nativeField(fieldPath, title);
	const fields = (document?.nativeFields(fieldPath) ?? []).filter(
		(field) => !excluded.has(field.name)
	);
	const isCollection = current?.kind === 'mapping' || current?.kind === 'sequence';

	const apply = (action: (text: string) => string): string | undefined => {
		try {
			binding.setText(action(binding.text));
			return undefined;
		} catch (caught) {
			return composeErrorMessage(caught);
		}
	};
	const mutate = (action: (text: string) => string) => setError(apply(action));
	const save = (field: ComposeNativeField, kind: ComposeNativeKind, value: string) => {
		if (readOnly) return undefined;
		return apply((text) => savingNativeField(text, field, kind, value));
	};
	const childSchemaPath = (field: ComposeNativeField): ComposeFieldPathComponent[] => [
		...schemaPath,
		...field.path.slice(fieldPath.length)
	];

	const row = (field: ComposeNativeField) => {
		const label = ComposeDisplayText.title(field.name);
		switch (field.kind) {
			case 'mapping':
			case 'sequence':
				return (
					<ComposeLink
						key={pathID(field.path)}
						destination={{
							screen: 'nativeFields',
							binding: bindingRef,
							readOnly,
							fieldPath: field.path,
							schemaPath: childSchemaPath(field),
							title: field.name,
							excluding: []
						}}
					>
						<LabeledContent label={label}>
							<Text modifiers={[secondaryStyle]}>{nativeKindTitle[field.kind]}</Text>
						</LabeledContent>
					</ComposeLink>
				);
			case 'unsupported':
				return (
					<VStack key={pathID(field.path)} alignment="leading" spacing={4}>
						<Text>{label}</Text>
						<Text modifiers={[font({ textStyle: 'footnote' }), secondaryStyle]}>Unavailable</Text>
					</VStack>
				);
			case 'boolean':
				return (
					<Toggle
						key={pathID(field.path)}
						label={label}
						isOn={document?.nativeField(field.path).value.toLowerCase() === 'true'}
						onIsOnChange={(value) =>
							mutate((text) =>
								ComposeDocument.parse(text).settingNative(String(value), 'boolean', field.path)
							)
						}
						modifiers={[disabled(readOnly)]}
					/>
				);
			default: {
				const options = new ComposeFieldOptions(childSchemaPath(field));
				const isEditingThis =
					simpleEditing !== undefined && pathID(simpleEditing.path) === pathID(field.path);
				if (
					!isEditingThis &&
					(field.kind === 'string' || field.kind === 'number') &&
					options.values.length > 0
				) {
					const currentValue = document?.nativeField(field.path).value ?? field.value;
					return (
						<MenuPicker
							key={pathID(field.path)}
							label={label}
							selection={currentValue}
							onSelectionChange={(value: string) => {
								if (value === '__custom__') {
									setSimpleValue(field.value);
									setSimpleEditing(field);
								} else {
									mutate((text) =>
										ComposeDocument.parse(text).settingNative(value, field.kind, field.path)
									);
								}
							}}
							modifiers={[disabled(readOnly)]}
						>
							{!options.values.includes(field.value) ? (
								<Text modifiers={[tag(field.value)]}>{field.value}</Text>
							) : null}
							{options.values.map((value) => (
								<Text key={value} modifiers={[tag(value)]}>
									{options.label(value)}
								</Text>
							))}
							{options.allowsCustom ? (
								<Text modifiers={[tag('__custom__')]}>Custom value…</Text>
							) : null}
						</MenuPicker>
					);
				}
				if (isEditingThis) {
					return (
						<VStack
							key={pathID(field.path)}
							alignment="leading"
							spacing={10}
							modifiers={[padding({ vertical: 4 })]}
						>
							<LabeledContent label={label}>
								<BoundField
									placeholder="Value"
									value={simpleValue}
									onChange={setSimpleValue}
									modifiers={[
										textFieldStyle('plain'),
										multilineTextAlignment('trailing'),
										...(field.kind === 'number' ? [keyboardType('numbers-and-punctuation')] : []),
										accessibilityLabel(label),
										disabled(readOnly)
									]}
								/>
							</LabeledContent>
							<HStack modifiers={[buttonStyle('borderless')]}>
								<Spacer />
								<Button label="Cancel" onPress={() => setSimpleEditing(undefined)} />
								<Button
									label="Apply"
									onPress={() => {
										if (!simpleEditing) return;
										const result = save(simpleEditing, simpleEditing.kind, simpleValue);
										setError(result);
										if (result === undefined) setSimpleEditing(undefined);
									}}
									modifiers={[buttonStyle('borderedProminent')]}
								/>
							</HStack>
						</VStack>
					);
				}
				return (
					<Button
						key={pathID(field.path)}
						onPress={() => {
							if (editsInline(field)) {
								setSimpleValue(field.value);
								setSimpleEditing(field);
							} else {
								setEditing(field);
							}
						}}
						modifiers={[disabled(readOnly || simpleEditing !== undefined)]}
					>
						<LabeledContent label={label} modifiers={[lineLimit(3), foregroundStyle('primary')]}>
							<Text modifiers={[secondaryStyle]}>
								{field.kind === 'null' ? 'Empty' : field.value}
							</Text>
						</LabeledContent>
					</Button>
				);
			}
		}
	};

	const rows = fields.map(row);

	return (
		<Toolbar>
			<VStack spacing={0}>
				<Form modifiers={[navigationTitle(ComposeDisplayText.title(title)), ...plainTextInput]}>
					{current ? (
						isCollection ? (
							<>
								{readOnly || simpleEditing !== undefined ? (
									rows
								) : (
									<RowsForEach
										onDelete={(indices) =>
											mutate((text) => removingNativeFields(text, fields, indices))
										}
									>
										{rows}
									</RowsForEach>
								)}
								{fields.length === 0 ? (
									<Text modifiers={[secondaryStyle]}>
										{current.kind === 'sequence' ? 'No items' : 'No fields'}
									</Text>
								) : null}
							</>
						) : current.kind === 'null' ? (
							<>
								<Text modifiers={[secondaryStyle]}>No value configured</Text>
								{!readOnly ? (
									<Button label="Set value" onPress={() => setEditing(current)} />
								) : null}
							</>
						) : (
							row(current)
						)
					) : (
						<Text modifiers={[secondaryStyle]}>
							The document has a syntax error. Your text is preserved.
						</Text>
					)}
					{error !== undefined ? (
						<Section>
							<ErrorText error={error} />
						</Section>
					) : null}
				</Form>
				<Sheet isPresented={editing !== undefined} onDismiss={() => setEditing(undefined)}>
					{editing ? (
						<ComposeNativeValueSheet
							key={pathID(editing.path)}
							title={editing.name}
							kind={editing.kind}
							value={editing.value}
							needsName={false}
							dismiss={() => setEditing(undefined)}
							save={(_, kind, value) => save(editing, kind, value)}
						/>
					) : null}
				</Sheet>
				<ComposeAddFieldsSheet
					isPresented={adding}
					onDismiss={() => setAdding(false)}
					bindingRef={bindingRef}
					fieldPath={fieldPath}
					excluding={destination.excluding}
					schemaPath={schemaPath}
				/>
			</VStack>
			<Toolbar.Content>
				{!readOnly && (isCollection || current?.kind === 'null') ? (
					<ToolbarItem placement="primaryAction">
						<EllipsisMenu label="Configuration actions">
							<Button label="Add" systemImage="plus" onPress={() => setAdding(true)} />
						</EllipsisMenu>
					</ToolbarItem>
				) : null}
			</Toolbar.Content>
		</Toolbar>
	);
}

function ComposeNativeValueSheet({
	title,
	kind: initialKind,
	value: initialValue,
	needsName,
	save,
	dismiss
}: {
	title: string;
	kind: ComposeNativeKind;
	value: string;
	needsName: boolean;
	save: (name: string, kind: ComposeNativeKind, value: string) => string | undefined;
	dismiss: () => void;
}) {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const [name, setName] = useState('');
	const [kind, setKind] = useState(initialKind);
	const [value, setValue] = useState(initialValue);
	const [error, setError] = useState<string>();
	return (
		<NavigationStack modifiers={[presentationDetents(['medium', 'large'])]}>
			<Toolbar>
				<Form
					modifiers={[
						navigationTitle(ComposeDisplayText.title(title)),
						navigationBarTitleDisplayMode('inline'),
						...plainTextInput
					]}
				>
					{needsName ? <BoundField placeholder="Name" value={name} onChange={setName} /> : null}
					{needsName || kind === 'null' ? (
						<MenuPicker
							label="Type"
							selection={kind}
							onSelectionChange={(next: string) => setKind(next as ComposeNativeKind)}
						>
							{editableNativeKinds.map((option) => (
								<Text key={option} modifiers={[tag(option)]}>
									{nativeKindTitle[option]}
								</Text>
							))}
						</MenuPicker>
					) : null}
					{kind === 'string' ? (
						<BoundField
							placeholder="Value"
							value={value}
							onChange={setValue}
							axis="vertical"
							modifiers={[lineLimit(12)]}
						/>
					) : null}
					{kind === 'number' ? (
						<BoundField
							placeholder="Value"
							value={value}
							onChange={setValue}
							modifiers={[keyboardType('numbers-and-punctuation')]}
						/>
					) : null}
					{kind === 'boolean' ? (
						<Toggle
							label="Enabled"
							isOn={value.toLowerCase() === 'true'}
							onIsOnChange={(enabled) => setValue(String(enabled))}
						/>
					) : null}
					{kind === 'mapping' ? (
						<Text modifiers={[secondaryStyle]}>Add fields after creating this object.</Text>
					) : null}
					{kind === 'sequence' ? (
						<Text modifiers={[secondaryStyle]}>Add items after creating this list.</Text>
					) : null}
					{kind === 'null' ? <Text modifiers={[secondaryStyle]}>Store an empty value.</Text> : null}
					<ErrorText error={error} />
				</Form>
				<Toolbar.Content>
					<ToolbarItem placement="cancellationAction">
						<Button label="Cancel" onPress={dismiss} modifiers={toolbarSymbol} />
					</ToolbarItem>
					<ToolbarItem placement="confirmationAction">
						<Button
							label="Apply"
							onPress={() => {
								const result = save(name, kind, value);
								setError(result);
								if (result === undefined) dismiss();
							}}
							modifiers={[disabled(needsName && name === ''), ...toolbarSymbol]}
						/>
					</ToolbarItem>
				</Toolbar.Content>
			</Toolbar>
		</NavigationStack>
	);
}

// MARK: - ComposeAddFieldsSheet

export function ComposeAddFieldsSheet({
	isPresented,
	onDismiss,
	bindingRef,
	fieldPath,
	excluding,
	schemaPath,
	includesProjectSettings,
	preferredService
}: {
	isPresented: boolean;
	onDismiss: () => void;
	bindingRef: ComposeBindingRef;
	fieldPath: ComposeFieldPathComponent[];
	excluding?: string[];
	schemaPath?: ComposeFieldPathComponent[];
	includesProjectSettings?: boolean;
	preferredService?: string;
}) {
	return (
		<Sheet isPresented={isPresented} onDismiss={onDismiss}>
			<AddFieldsContent
				bindingRef={bindingRef}
				options={{ fieldPath, excluding, schemaPath, includesProjectSettings, preferredService }}
				dismiss={onDismiss}
			/>
		</Sheet>
	);
}

function AddFieldsContent({
	bindingRef,
	options,
	dismiss
}: {
	bindingRef: ComposeBindingRef;
	options: Parameters<typeof useAddFields>[2];
	dismiss: () => void;
}) {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const binding = useComposeBinding(bindingRef);
	const model = useAddFields(binding.text, binding.setText, options);
	const searchText = useNativeState(model.search);

	if (model.isList) {
		return model.draft ? (
			<ComposeSettingEditor
				key={model.draft.id}
				draft={model.draft}
				needsName={false}
				save={model.add}
				dismiss={dismiss}
			/>
		) : (
			<NavigationStack>
				<Form>
					<Text />
				</Form>
			</NavigationStack>
		);
	}

	const fieldButton = (field: ComposeSchemaField, project = false) => (
		<Button
			key={`${project ? 'p' : 's'}-${field.name}`}
			onPress={() => model.select(field, project)}
		>
			<VStack alignment="leading" spacing={4} modifiers={[padding({ vertical: 3 })]}>
				<Text modifiers={[foregroundStyle('primary')]}>{ComposeDisplayText.title(field.name)}</Text>
				{field.description !== '' ? (
					<Text
						modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), lineLimit(2)]}
					>
						{field.description}
					</Text>
				) : null}
			</VStack>
		</Button>
	);
	const customFieldButton = (title: string, project = false) => (
		<Button
			key={title}
			label={title}
			systemImage="plus"
			onPress={() => model.select(undefined, project)}
		/>
	);

	return (
		<NavigationStack>
			<VStack spacing={0}>
				<Toolbar>
					<List
						modifiers={[
							searchable(searchText, {
								prompt: 'Find a Compose setting',
								onChange: model.setSearch
							}),
							navigationTitle('Add configuration'),
							navigationBarTitleDisplayMode('inline'),
							...plainTextInput
						]}
					>
						{model.includesProjectSettings ? (
							<>
								<Section
									footer={
										model.serviceSelection === '' ? (
											<Text>Enter a name, then choose a setting below to create the service.</Text>
										) : undefined
									}
								>
									{model.services.length > 0 ? (
										<MenuPicker
											label="Service"
											selection={model.serviceSelection}
											onSelectionChange={(value: string) => model.setServiceSelection(value)}
										>
											{model.services.map((service) => (
												<Text key={service} modifiers={[tag(service)]}>
													{service}
												</Text>
											))}
											<Text modifiers={[tag('')]}>New service</Text>
										</MenuPicker>
									) : null}
									{model.serviceSelection === '' ? (
										<BoundField
											placeholder="Service name"
											value={model.newServiceName}
											onChange={model.setNewServiceName}
										/>
									) : null}
									<ErrorText error={model.error} />
								</Section>
								<Section title="Service settings">
									{model.available.map((field) => fieldButton(field))}
									{customFieldButton('Custom service field')}
								</Section>
								<Section title="Project settings">
									{model.projectFields.map((field) => fieldButton(field, true))}
									{customFieldButton('Custom project field', true)}
								</Section>
							</>
						) : (
							<>
								{model.available.map((field) => fieldButton(field))}
								{customFieldButton('Custom field')}
							</>
						)}
					</List>
					<Toolbar.Content>
						<ToolbarItem placement="cancellationAction">
							<Button label="Cancel" onPress={dismiss} modifiers={toolbarSymbol} />
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
				<Sheet isPresented={model.draft !== undefined} onDismiss={() => model.setDraft(undefined)}>
					{model.draft ? (
						<ComposeSettingEditor
							key={model.draft.id}
							draft={model.draft}
							needsName={model.needsName}
							save={model.add}
							dismiss={() => model.setDraft(undefined)}
						/>
					) : null}
				</Sheet>
			</VStack>
		</NavigationStack>
	);
}

// MARK: - ComposeSettingEditor

export function ComposeSettingEditor({
	draft: initial,
	needsName,
	save,
	dismiss
}: {
	draft: ComposeSettingDraft;
	needsName: boolean;
	save: (draft: ComposeSettingDraft) => string | undefined;
	dismiss: () => void;
}) {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const [draft, setDraft] = useState(initial);
	const [error, setError] = useState<string>();
	return (
		<NavigationStack
			modifiers={[presentationDetents(['large']), presentationDragIndicator('visible')]}
		>
			<Toolbar>
				<Form
					modifiers={[
						textFieldStyle('plain'),
						navigationTitle(needsName ? 'New setting' : ComposeDisplayText.title(draft.name)),
						navigationBarTitleDisplayMode('inline'),
						...plainTextInput
					]}
				>
					{needsName ? (
						<BoundField
							placeholder="Setting name"
							value={draft.name}
							onChange={(name) => setDraft({ ...draft, name })}
						/>
					) : null}
					<Section>
						<ComposeSettingFields draft={draft} onChange={setDraft} root />
					</Section>
					{error !== undefined ? (
						<Section>
							<ErrorText error={error} />
						</Section>
					) : null}
				</Form>
				<Toolbar.Content>
					<ToolbarItem placement="cancellationAction">
						<Button label="Cancel" onPress={dismiss} modifiers={toolbarSymbol} />
					</ToolbarItem>
					<ToolbarItem placement="confirmationAction">
						<Button
							label="Add"
							onPress={() => {
								const result = save(draft);
								setError(result);
								if (result === undefined) dismiss();
							}}
							modifiers={[disabled(needsName && draft.name.trim() === ''), ...toolbarSymbol]}
						/>
					</ToolbarItem>
				</Toolbar.Content>
			</Toolbar>
		</NavigationStack>
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

function ComposeSettingFields({
	draft,
	onChange,
	root = false,
	namedEntry = false
}: {
	draft: ComposeSettingDraft;
	onChange: (draft: ComposeSettingDraft) => void;
	root?: boolean;
	namedEntry?: boolean;
}) {
	const [expanded, setExpanded] = useState(false);
	const title = draft.name === '' ? 'Value' : ComposeDisplayText.title(draft.name);
	const choices = draftSchema(draft)?.kinds ?? editableNativeKinds;
	const options = new ComposeFieldOptions(draft.schemaPath);
	const collection = draft.kind === 'mapping' || draft.kind === 'sequence';
	const updateChild = (index: number, child: ComposeSettingDraft) =>
		onChange({
			...draft,
			children: draft.children.map((existing, i) => (i === index ? child : existing))
		});
	const removeChildren = (indices: number[]) =>
		onChange({ ...draft, children: draft.children.filter((_, i) => !indices.includes(i)) });

	const contents = (
		<>
			{root && (descriptionFor(draft) ?? '') !== '' ? (
				<Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary')]}>
					{descriptionFor(draft)!}
				</Text>
			) : null}
			{namedEntry ? (
				<LabeledContent label="Name">
					<BoundField
						placeholder="Name"
						value={draft.name}
						onChange={(name) =>
							onChange({ ...draft, name, included: name !== '' || draft.value !== '' })
						}
						modifiers={[textFieldStyle('plain'), multilineTextAlignment('trailing')]}
					/>
				</LabeledContent>
			) : null}
			{draft.kind === 'mapping' ? (
				<>
					<RowsForEach onDelete={draftFields(draft).length === 0 ? removeChildren : undefined}>
						{draft.children.map((child, index) => (
							<ComposeSettingFields
								key={child.id}
								draft={child}
								onChange={(next) => updateChild(index, next)}
								namedEntry={draftFields(draft).length === 0}
							/>
						))}
					</RowsForEach>
					{draftFields(draft).length === 0 ? (
						<Button
							label="Add entry"
							systemImage="plus"
							onPress={() => onChange(appendEntry(draft))}
							modifiers={[buttonStyle('borderless')]}
						/>
					) : null}
				</>
			) : null}
			{draft.kind === 'sequence' ? (
				<>
					<RowsForEach onDelete={removeChildren}>
						{draft.children.map((child, index) => (
							<ComposeSettingFields
								key={child.id}
								draft={child}
								onChange={(next) => updateChild(index, next)}
								root
							/>
						))}
					</RowsForEach>
					<Button
						label="Add item"
						systemImage="plus"
						onPress={() => onChange(appendEntry(draft))}
						modifiers={[buttonStyle('borderless')]}
					/>
				</>
			) : null}
			{draft.kind === 'boolean' ? (
				<Toggle
					label={title}
					isOn={draft.value === 'true'}
					onIsOnChange={(enabled) => onChange({ ...draft, value: String(enabled), included: true })}
				/>
			) : null}
			{draft.kind === 'string' || draft.kind === 'number' ? (
				options.values.length > 0 ? (
					<ComposeValuePicker
						title={title}
						options={options}
						value={draft.value}
						onChange={(value) => onChange({ ...draft, value, included: value !== '' })}
					/>
				) : (
					<LabeledContent label={namedEntry ? 'Value' : title}>
						<BoundField
							placeholder={placeholderFor(draft.name)}
							value={draft.value}
							onChange={(value) =>
								onChange({
									...draft,
									value,
									included: namedEntry ? draft.name !== '' || value !== '' : value !== ''
								})
							}
							modifiers={[
								textFieldStyle('plain'),
								multilineTextAlignment('trailing'),
								...(draft.kind === 'number' ? [keyboardType('numbers-and-punctuation')] : []),
								accessibilityLabel(namedEntry ? 'Value' : title)
							]}
						/>
					</LabeledContent>
				)
			) : null}
			{draft.kind === 'null' ? (
				<Text modifiers={[foregroundStyle('secondary')]}>Leave this setting empty.</Text>
			) : null}
			{draft.kind === 'unsupported' ? (
				<Text modifiers={[foregroundStyle('secondary')]}>{"This value can't be edited here."}</Text>
			) : null}
		</>
	);

	let body;
	if (!root && collection && !namedEntry) {
		body = (
			<DisclosureGroup
				label={title}
				isExpanded={expanded}
				onIsExpandedChange={(open) => {
					setExpanded(open);
					if (open) onChange(prepareFields(draft));
				}}
			>
				{expanded ? contents : <Text />}
			</DisclosureGroup>
		);
	} else if (
		namedEntry &&
		(draft.kind === 'string' || draft.kind === 'number') &&
		options.values.length === 0
	) {
		body = (
			<HStack>
				<BoundField
					placeholder="Name"
					value={draft.name}
					onChange={(name) =>
						onChange({ ...draft, name, included: name !== '' || draft.value !== '' })
					}
					modifiers={[accessibilityLabel('Name')]}
				/>
				<BoundField
					placeholder="Value"
					value={draft.value}
					onChange={(value) =>
						onChange({ ...draft, value, included: draft.name !== '' || value !== '' })
					}
					modifiers={[multilineTextAlignment('trailing'), accessibilityLabel('Value')]}
				/>
			</HStack>
		);
	} else {
		body = contents;
	}

	if (choices.length <= 1) return body;
	return (
		<ContextMenu>
			<ContextMenu.Trigger>{body}</ContextMenu.Trigger>
			<ContextMenu.Items>
				<Picker
					label="Enter as"
					selection={draft.kind}
					onSelectionChange={(kind: string) =>
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
				>
					{choices.map((kind) => (
						<Text key={kind} modifiers={[tag(kind)]}>
							{formatName(draft, kind)}
						</Text>
					))}
				</Picker>
			</ContextMenu.Items>
		</ContextMenu>
	);
}
