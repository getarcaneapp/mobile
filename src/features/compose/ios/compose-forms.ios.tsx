import {
	Button,
	ContentUnavailableView,
	ContextMenu,
	Form,
	HStack,
	LabeledContent,
	NavigationStack,
	Section,
	Spacer,
	SwipeActions,
	Text,
	Toggle,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import {
	accessibilityLabel,
	disabled,
	font,
	foregroundStyle,
	lineLimit,
	navigationTitle,
	privacySensitive,
	tag,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { useState, type ReactNode } from 'react';

import { systemColors } from '@/theme/colors';
import { DestructiveLabel } from '@/ui/components/labels';
import { Image } from '@/ui/components/swiftui-image';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';

import {
	addingAttachment,
	addingMappingEntry,
	addingStringValue,
	attachmentNames,
	attempt,
	booleanFieldState,
	collectionItems,
	collectionNativeFallback,
	decodedItem,
	entryName,
	entryWrapper,
	fieldNames,
	mappingNativeFallback,
	rawFromWrapper,
	removingAttachments,
	removingItems,
	savingCollectionEntry,
	scalarFieldState,
	settingBoolean,
	settingScalar,
	stringListNeedsNativeFields,
	validName,
	type EntrySelection
} from '../compose-actions';
import { nativeFieldsDestination, type ComposeDestination } from '../compose-destinations';
import {
	makeSessionID,
	useComposeBinding,
	useComposeSessionHost,
	withTransform,
	type ComposeBindingRef
} from '../compose-session';
import { ComposeDocument } from '../model/compose-document';
import { ComposeEntryDraft, type ComposeEntryKind } from '../model/compose-entry-draft';
import { composeErrorMessage } from '../model/compose-errors';
import type { ComposeFieldOptions } from '../model/compose-field-options';
import { keyPath, type ComposeFieldPathComponent } from '../model/compose-native-field';
import { ComposeNavigationStack } from './compose-destination-view.ios';
import { ComposeNativeFieldsForm, ComposeAddFieldsSheet } from './compose-native-fields.ios';
import { ComposeResourcePicker } from './compose-resources.ios';
import {
	DeletableSection,
	RowsForEach,
	MenuPicker,
	BoundField,
	ComposeLink,
	EllipsisMenu,
	ErrorText,
	plainTextInput,
	SecondaryText,
	Sheet,
	TitleLink,
	TrailingField,
	ValueRow
} from './compose-ui.ios';

function AddConfigurationToolbar({
	readOnly,
	onAdd,
	children
}: {
	readOnly: boolean;
	onAdd: () => void;
	children: ReactNode;
}) {
	return (
		<Toolbar>
			<VStack spacing={0}>{children}</VStack>
			<Toolbar.Content>
				{!readOnly ? (
					<ToolbarItem placement="primaryAction">
						<EllipsisMenu label="Configuration actions">
							<Button label="Add configuration" systemImage="plus" onPress={onAdd} />
						</EllipsisMenu>
					</ToolbarItem>
				) : null}
			</Toolbar.Content>
		</Toolbar>
	);
}

function AddToolbar({
	show,
	onAdd,
	children
}: {
	show: boolean;
	onAdd: () => void;
	children: ReactNode;
}) {
	return (
		<Toolbar>
			<VStack spacing={0}>{children}</VStack>
			<Toolbar.Content>
				{show ? (
					<ToolbarItem placement="primaryAction">
						<Button label="Add" systemImage="plus" onPress={onAdd} />
					</ToolbarItem>
				) : null}
			</Toolbar.Content>
		</Toolbar>
	);
}

function DeleteItems({ readOnly, onDelete }: { readOnly: boolean; onDelete: () => void }) {
	if (readOnly) return null;
	return (
		<Button role="destructive" onPress={onDelete} modifiers={[tint(systemColors.red)]}>
			<DestructiveLabel text="Delete" />
		</Button>
	);
}

export function ComposeValuePicker({
	title,
	options,
	value,
	onChange
}: {
	title: string;
	options: ComposeFieldOptions;
	value: string;
	onChange: (value: string) => void;
}) {
	const [custom, setCustom] = useState(false);
	const isOther = value !== '' && !options.values.includes(value);
	const selection = custom || isOther ? '__custom__' : value;
	return (
		<>
			<MenuPicker
				label={title}
				selection={selection}
				onSelectionChange={(next: string) => {
					const isCustom = next === '__custom__';
					setCustom(isCustom);
					if (!isCustom) onChange(next);
					else if (options.values.includes(value)) onChange('');
				}}
			>
				<Text modifiers={[tag('')]}>Choose…</Text>
				{options.values.map((option) => (
					<Text key={option} modifiers={[tag(option)]}>
						{options.label(option)}
					</Text>
				))}
				{options.allowsCustom ? (
					<Text modifiers={[tag('__custom__')]}>Custom value…</Text>
				) : isOther ? (
					<Text modifiers={[tag('__custom__')]}>{value}</Text>
				) : null}
			</MenuPicker>
			{options.allowsCustom && (custom || isOther) ? (
				<BoundField placeholder="Custom value or ${VARIABLE}" value={value} onChange={onChange} />
			) : null}
		</>
	);
}

export function ComposeScalarField({
	bindingRef,
	path,
	title,
	readOnly,
	integer = false
}: {
	bindingRef: ComposeBindingRef;
	path: string[];
	title: string;
	readOnly: boolean;
	integer?: boolean;
}) {
	const binding = useComposeBinding(bindingRef);
	const [error, setError] = useState<string>();
	const state = scalarFieldState(binding.text, path);
	if (!state.editable) return <ValueRow title={title} value="Unavailable" />;
	const set = (value: string) => {
		if (readOnly) return;
		try {
			binding.setText(settingScalar(binding.text, path, value, integer));
			setError(undefined);
		} catch (caught) {
			setError(composeErrorMessage(caught));
		}
	};
	return (
		<>
			{state.options.values.length === 0 ? (
				<TrailingField title={title} value={state.value} onChange={set} disabled={readOnly} />
			) : (
				<VStack modifiers={[disabled(readOnly)]}>
					<ComposeValuePicker
						title={title}
						options={state.options}
						value={state.value}
						onChange={set}
					/>
				</VStack>
			)}
			<ErrorText error={error} caption />
		</>
	);
}

export function ComposeBooleanField({
	bindingRef,
	path,
	title,
	readOnly,
	defaultValue = false
}: {
	bindingRef: ComposeBindingRef;
	path: string[];
	title: string;
	readOnly: boolean;
	defaultValue?: boolean;
}) {
	const binding = useComposeBinding(bindingRef);
	const [error, setError] = useState<string>();
	const state = booleanFieldState(binding.text, path, defaultValue);
	return (
		<>
			{state.editable ? (
				<Toggle
					label={title}
					isOn={state.isOn}
					onIsOnChange={(enabled) => {
						if (readOnly) return;
						try {
							binding.setText(settingBoolean(binding.text, path, enabled));
							setError(undefined);
						} catch (caught) {
							setError(composeErrorMessage(caught));
						}
					}}
					modifiers={[disabled(readOnly)]}
				/>
			) : (
				<ValueRow title={title} value="Unavailable" />
			)}
			<ErrorText error={error} />
		</>
	);
}

export function ComposeNameSheet({
	isPresented,
	onDismiss,
	title,
	placeholder,
	save
}: {
	isPresented: boolean;
	onDismiss: () => void;
	title: string;
	placeholder: string;
	save: (name: string) => string | undefined;
}) {
	return (
		<Sheet isPresented={isPresented} onDismiss={onDismiss}>
			<NameSheetContent title={title} placeholder={placeholder} save={save} dismiss={onDismiss} />
		</Sheet>
	);
}

function NameSheetContent({
	title,
	placeholder,
	save,
	dismiss
}: {
	title: string;
	placeholder: string;
	save: (name: string) => string | undefined;
	dismiss: () => void;
}) {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const [name, setName] = useState('');
	const [error, setError] = useState<string>();
	return (
		<NavigationStack>
			<Toolbar>
				<Form modifiers={[navigationTitle(title), ...plainTextInput]}>
					<BoundField placeholder={placeholder} value={name} onChange={setName} />
					<ErrorText error={error} />
				</Form>
				<Toolbar.Content>
					<ToolbarItem placement="cancellationAction">
						<Button label="Cancel" onPress={dismiss} modifiers={toolbarSymbol} />
					</ToolbarItem>
					<ToolbarItem placement="confirmationAction">
						<Button
							label="Add"
							onPress={() => {
								const result = save(name);
								setError(result);
								if (result === undefined) dismiss();
							}}
							modifiers={[disabled(!validName(name)), ...toolbarSymbol]}
						/>
					</ToolbarItem>
				</Toolbar.Content>
			</Toolbar>
		</NavigationStack>
	);
}

export function ComposeMappingForm({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'mapping' }>;
}) {
	const { binding: bindingRef, path, title, resource, readOnly, sensitive } = destination;
	const binding = useComposeBinding(bindingRef);
	const [adding, setAdding] = useState(false);
	const [error, setError] = useState<string>();
	const [revealed, setRevealed] = useState<Set<string>>(new Set());
	const document = ComposeDocument.tryParse(binding.text);

	if (mappingNativeFallback(document, path)) {
		return (
			<ComposeNativeFieldsForm
				destination={
					nativeFieldsDestination(bindingRef, path, title, readOnly) as Extract<
						ComposeDestination,
						{ screen: 'nativeFields' }
					>
				}
			/>
		);
	}
	if (!resource && document?.items(path) !== undefined) {
		return (
			<ComposeCollectionForm
				destination={{
					screen: 'collection',
					binding: bindingRef,
					readOnly,
					path,
					title,
					kind: 'keyValue'
				}}
			/>
		);
	}

	const change = (action: (document: ComposeDocument) => string) => {
		const result = attempt(binding.text, action);
		if ('text' in result) {
			binding.setText(result.text);
			setError(undefined);
		} else {
			setError(result.error);
		}
		return 'error' in result ? result.error : undefined;
	};
	const toggleReveal = (key: string) =>
		setRevealed((current) => {
			const next = new Set(current);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});

	const editable = document?.isEditable(path) ?? false;
	const keys = document && editable ? document.keys(path) : [];
	const sections = keys.map((key) => {
		const plainValue =
			document!.scalar([...path, key]) !== undefined ||
			document!.rawValue([...path, key]) === undefined;
		const shown = revealed.has(key) || title === 'Labels' || !sensitive;
		return (
			<DeletableSection
				key={key}
				title={key}
				readOnly={readOnly}
				onDelete={() => change((current) => current.removing([...path, key]))}
			>
				{resource ? (
					<ValueRow title="Name" value={key} />
				) : plainValue ? (
					<HStack modifiers={[disabled(readOnly), privacySensitive(true)]}>
						<BoundField
							placeholder="Value"
							value={document!.scalar([...path, key]) ?? ''}
							onChange={(value) =>
								change((current) => current.setting(ComposeDocument.quoted(value), [...path, key]))
							}
							secure={!shown}
							modifiers={[accessibilityLabel(key)]}
						/>
						{title !== 'Labels' && sensitive ? (
							<Button
								label={revealed.has(key) ? 'Hide' : 'Reveal'}
								onPress={() => toggleReveal(key)}
							/>
						) : null}
					</HStack>
				) : (
					<SecondaryText>Unsupported value</SecondaryText>
				)}
			</DeletableSection>
		);
	});

	return (
		<AddToolbar show={!readOnly} onAdd={() => setAdding(true)}>
			<Form modifiers={[navigationTitle(title), ...plainTextInput]}>
				{document && editable ? (
					<>
						{sections}
						{keys.length === 0 ? (
							<ContentUnavailableView
								title={'No ' + title.toLowerCase()}
								systemImage="list.bullet"
								description="Use Add to create an entry."
							/>
						) : null}
					</>
				) : (
					<Text>Unsupported format</Text>
				)}
				<ErrorText error={error} />
			</Form>
			<ComposeNameSheet
				isPresented={adding}
				onDismiss={() => setAdding(false)}
				title="Add entry"
				placeholder="Name"
				save={(name) => change((current) => addingMappingEntry(current, path, name))}
			/>
		</AddToolbar>
	);
}

let nextSelection = 0;

export function ComposeCollectionForm({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'collection' }>;
}) {
	const { binding: bindingRef, path, title, kind, readOnly } = destination;
	const binding = useComposeBinding(bindingRef);
	const [editing, setEditing] = useState<EntrySelection>();
	const [error, setError] = useState<string>();
	const document = ComposeDocument.tryParse(binding.text);

	if (collectionNativeFallback(document, path)) {
		return (
			<ComposeNativeFieldsForm
				destination={
					nativeFieldsDestination(bindingRef, path, title, readOnly) as Extract<
						ComposeDestination,
						{ screen: 'nativeFields' }
					>
				}
			/>
		);
	}

	const items = collectionItems(document, path);
	const remove = (indices: number[]) => {
		try {
			binding.setText(removingItems(binding.text, path, indices));
			setError(undefined);
		} catch (caught) {
			setError(composeErrorMessage(caught));
		}
	};
	const select = (index: number | undefined, raw: string) =>
		setEditing({ id: `entry-${++nextSelection}`, index, raw });

	const rows = (items ?? []).map((item, index) => (
		<ContextMenu key={`${index}-${item}`}>
			<ContextMenu.Trigger>
				<Button onPress={() => select(index, item)} modifiers={[disabled(readOnly)]}>
					<HStack>
						<Text modifiers={[foregroundStyle('primary'), lineLimit(2)]}>
							{kind === 'keyValue' ? entryName(item) : item}
						</Text>
						<Spacer />
						<Image systemName="chevron.right" modifiers={[foregroundStyle('secondary')]} />
					</HStack>
				</Button>
			</ContextMenu.Trigger>
			<ContextMenu.Items>
				<DeleteItems readOnly={readOnly} onDelete={() => remove([index])} />
			</ContextMenu.Items>
		</ContextMenu>
	));

	return (
		<AddToolbar show={!readOnly} onAdd={() => select(undefined, '')}>
			<Form modifiers={[navigationTitle(title)]}>
				{items !== undefined ? (
					<>
						{readOnly ? rows : <RowsForEach onDelete={remove}>{rows}</RowsForEach>}
						{items.length === 0 ? (
							<ContentUnavailableView
								title={'No ' + title.toLowerCase()}
								systemImage="list.bullet"
								description="Use Add to create an entry."
							/>
						) : null}
					</>
				) : kind === 'network' ? (
					<TitleLink
						title="Network attachments"
						destination={{ screen: 'networkAttachments', binding: bindingRef, readOnly, path }}
					/>
				) : (
					<Text>Unsupported format</Text>
				)}
				<ErrorText error={error} />
			</Form>
			<Sheet isPresented={editing !== undefined} onDismiss={() => setEditing(undefined)}>
				{editing ? (
					<ComposeEntrySheet
						key={editing.id}
						kind={kind}
						original={editing.raw}
						schemaPath={[...keyPath(path), { index: editing.index ?? 0 }]}
						dismiss={() => setEditing(undefined)}
						save={(raw, externalResource) => {
							try {
								const result = savingCollectionEntry(
									binding.text,
									path,
									kind,
									editing,
									raw,
									externalResource
								);
								if (result !== undefined) binding.setText(result);
								setError(undefined);
								return undefined;
							} catch (caught) {
								return composeErrorMessage(caught);
							}
						}}
					/>
				) : null}
			</Sheet>
		</AddToolbar>
	);
}

function newDraft(
	raw: string,
	kind: ComposeEntryKind
): { draft: ComposeEntryDraft; supported: boolean } {
	try {
		return { draft: new ComposeEntryDraft(raw, kind), supported: true };
	} catch {
		return { draft: new ComposeEntryDraft(), supported: false };
	}
}

function ComposeEntrySheet({
	kind,
	original,
	schemaPath,
	save,
	dismiss
}: {
	kind: ComposeEntryKind;
	original: string;
	schemaPath: ComposeFieldPathComponent[];
	save: (raw: string, externalResource?: string) => string | undefined;
	dismiss: () => void;
}) {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const [initial] = useState(() => newDraft(original, kind));
	const [draft, setDraft] = useState(initial.draft);
	const [supported, setSupported] = useState(initial.supported);
	const [error, setError] = useState<string>();
	const [reveal, setReveal] = useState(false);
	const [showResources, setShowResources] = useState(false);
	const [externalResource, setExternalResource] = useState<string>();
	const [nativeSource, setNativeSource] = useState(original);
	const [showNativeSettings, setShowNativeSettings] = useState(false);
	const [nativeWrapper, setNativeWrapper] = useState('');
	const [wrapperSession] = useState(() => makeSessionID('compose-entry'));
	useComposeSessionHost(wrapperSession, nativeWrapper, setNativeWrapper);

	const update = (changes: Parameters<ComposeEntryDraft['with']>[0]) =>
		setDraft((current) => current.with(changes));
	const field = (
		title: string,
		placeholder: string,
		value: string,
		onChange: (value: string) => void,
		number = false
	) => (
		<TrailingField
			title={title}
			placeholder={placeholder}
			value={value}
			onChange={onChange}
			number={number}
		/>
	);
	const applyNativeSettings = () => {
		try {
			const raw = rawFromWrapper(nativeWrapper);
			setNativeSource(raw);
			const next = newDraft(raw, kind);
			if (next.supported) setDraft(next.draft);
			setSupported(next.supported);
			setExternalResource(undefined);
			setError(undefined);
		} catch (caught) {
			setError(composeErrorMessage(caught));
		}
	};
	const resourceButton = (
		<>
			<Button label="Choose existing resource" onPress={() => setShowResources(true)} />
			{externalResource !== undefined && externalResource === draft.source ? (
				<Text
					modifiers={[
						font({ textStyle: 'footnote' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					This resource will be declared external in the Compose file.
				</Text>
			) : null}
		</>
	);

	let fields: ReactNode;
	switch (kind) {
		case 'port':
			fields = (
				<>
					{field('Host address (optional)', 'Host address', draft.address, (address) =>
						update({ address })
					)}
					{field(
						'Host port (optional)',
						'Host port',
						draft.source,
						(source) => update({ source }),
						true
					)}
					{field(
						'Container port',
						'Container port',
						draft.target,
						(target) => update({ target }),
						true
					)}
					<MenuPicker
						label="Protocol"
						selection={draft.option}
						onSelectionChange={(option: string) => update({ option })}
					>
						<Text modifiers={[tag('tcp')]}>TCP</Text>
						<Text modifiers={[tag('udp')]}>UDP</Text>
						<Text modifiers={[tag('sctp')]}>SCTP</Text>
					</MenuPicker>
				</>
			);
			break;
		case 'mount':
			fields = (
				<>
					{field(
						'Volume name or host path (optional)',
						'Volume name or host path',
						draft.source,
						(source) => update({ source })
					)}
					{field('Container path', 'Container path', draft.target, (target) => update({ target }))}
					<Toggle
						label="Read only"
						isOn={draft.readOnly}
						onIsOnChange={(readOnly) => update({ readOnly })}
					/>
					{resourceButton}
				</>
			);
			break;
		case 'keyValue':
			fields = (
				<>
					{field('Name', 'Name', draft.source, (source) => update({ source }))}
					<LabeledContent label="Value">
						<BoundField
							placeholder="Value"
							value={draft.target}
							onChange={(target) => update({ target })}
							secure={!reveal}
							modifiers={[privacySensitive(true)]}
						/>
					</LabeledContent>
					<Toggle label="Reveal value" isOn={reveal} onIsOnChange={setReveal} />
				</>
			);
			break;
		case 'network':
			fields = (
				<>
					{field('Network name', 'Network name', draft.source, (source) => update({ source }))}
					{resourceButton}
				</>
			);
			break;
	}

	return (
		<NavigationStack>
			<VStack spacing={0}>
				<Toolbar>
					<Form
						modifiers={[
							navigationTitle(original === '' ? 'Add entry' : 'Edit entry'),
							...plainTextInput
						]}
					>
						{supported ? fields : <Text>Unsupported format</Text>}
						{kind === 'port' || kind === 'mount' ? (
							<Button
								label="All settings"
								onPress={() => {
									try {
										const source = supported ? draft.yaml(kind) : nativeSource;
										setNativeSource(source);
										setNativeWrapper(entryWrapper(source));
										setShowNativeSettings(true);
									} catch (caught) {
										setError(composeErrorMessage(caught));
									}
								}}
							/>
						) : null}
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
									try {
										const raw = supported ? draft.yaml(kind) : nativeSource;
										const result = save(
											raw,
											supported &&
												externalResource !== undefined &&
												externalResource === draft.source
												? externalResource
												: undefined
										);
										setError(result);
										if (result === undefined) dismiss();
									} catch (caught) {
										setError(composeErrorMessage(caught));
									}
								}}
								modifiers={[disabled(!supported && nativeSource === ''), ...toolbarSymbol]}
							/>
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
				<Sheet
					isPresented={showNativeSettings}
					onDismiss={() => {
						setShowNativeSettings(false);
						applyNativeSettings();
					}}
				>
					<ComposeNavigationStack>
						<Toolbar>
							<ComposeNativeFieldsForm
								destination={
									nativeFieldsDestination(
										{ session: wrapperSession },
										['entry'],
										'Entry settings',
										false,
										[],
										schemaPath
									) as Extract<ComposeDestination, { screen: 'nativeFields' }>
								}
							/>
							<Toolbar.Content>
								<ToolbarItem placement="confirmationAction">
									<Button
										label="Done"
										onPress={() => {
											setShowNativeSettings(false);
											applyNativeSettings();
										}}
										modifiers={toolbarSymbol}
									/>
								</ToolbarItem>
							</Toolbar.Content>
						</Toolbar>
					</ComposeNavigationStack>
				</Sheet>
				<Sheet isPresented={showResources} onDismiss={() => setShowResources(false)}>
					<ComposeResourcePicker
						kind={kind}
						selection={draft.source}
						onSelect={(name) => {
							update({ source: name });
							setExternalResource(name);
						}}
						dismiss={() => setShowResources(false)}
					/>
				</Sheet>
			</VStack>
		</NavigationStack>
	);
}

export function ComposeStringListForm({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'stringList' }>;
}) {
	const {
		binding: bindingRef,
		path,
		title,
		readOnly,
		allowsScalar,
		environmentFiles
	} = destination;
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const binding = useComposeBinding(bindingRef);
	const [newValue, setNewValue] = useState('');
	const [adding, setAdding] = useState(false);
	const [error, setError] = useState<string>();
	const document = ComposeDocument.tryParse(binding.text);

	if (stringListNeedsNativeFields(document, path)) {
		return (
			<ComposeNativeFieldsForm
				destination={
					nativeFieldsDestination(bindingRef, path, title, readOnly) as Extract<
						ComposeDestination,
						{ screen: 'nativeFields' }
					>
				}
			/>
		);
	}

	const change = (action: (document: ComposeDocument) => string) => {
		if (readOnly) return undefined;
		const result = attempt(binding.text, action);
		if ('text' in result) {
			binding.setText(result.text);
			setError(undefined);
			return undefined;
		}
		setError(result.error);
		return result.error;
	};

	const items = document && document.isEditable(path) ? document.items(path) : undefined;
	let fields: ReactNode = null;
	if (document && items) {
		const rows = items.map((raw, index) => {
			const value = decodedItem(raw);
			if (value !== undefined) {
				return (
					<BoundField
						key={`${index}`}
						placeholder="Value"
						value={value}
						onChange={(next) =>
							change((current) => current.settingItem(ComposeDocument.quoted(next), path, index))
						}
						modifiers={[disabled(readOnly)]}
					/>
				);
			}
			const entry = environmentFiles ? ComposeDocument.tryParse(raw) : undefined;
			if (entry && entry.nativeField([]).kind === 'mapping') {
				return (
					<ComposeLink
						key={`${index}`}
						destination={{
							screen: 'envFile',
							binding: withTransform(bindingRef, { kind: 'item', path, index, original: raw }),
							readOnly,
							schemaPath: [...keyPath(path), { index }]
						}}
					>
						<Text>{entry.scalar(['path']) ?? 'Environment file'}</Text>
					</ComposeLink>
				);
			}
			return <ValueRow key={`${index}`} title="Value" value="Unsupported value" />;
		});
		fields = readOnly ? (
			rows
		) : (
			<RowsForEach onDelete={(indices) => change(() => removingItems(binding.text, path, indices))}>
				{rows}
			</RowsForEach>
		);
	} else if (
		document &&
		document.isEditable(path) &&
		allowsScalar &&
		document.scalar(path) !== undefined &&
		document.scalar(path) !== 'null' &&
		document.scalar(path) !== '~'
	) {
		fields = (
			<SwipeActions>
				<ComposeScalarField bindingRef={bindingRef} path={path} title="Value" readOnly={readOnly} />
				{!readOnly ? (
					<SwipeActions.Actions edge="trailing">
						<Button
							role="destructive"
							label="Delete"
							onPress={() => change((current) => current.removing(path))}
							modifiers={[tint(systemColors.red)]}
						/>
					</SwipeActions.Actions>
				) : null}
			</SwipeActions>
		);
	} else if (document?.rawValue(path) === undefined) {
		fields = null;
	} else {
		fields = <SecondaryText>Unsupported format</SecondaryText>;
	}

	return (
		<AddToolbar
			show={!readOnly}
			onAdd={() => {
				setNewValue('');
				setError(undefined);
				setAdding(true);
			}}
		>
			<Form modifiers={[navigationTitle(title), ...plainTextInput]}>
				<Section title={title}>{fields}</Section>
				<ErrorText error={error} />
			</Form>
			<Sheet isPresented={adding} onDismiss={() => setAdding(false)}>
				<NavigationStack>
					<Toolbar>
						<Form modifiers={[navigationTitle('Add value'), ...plainTextInput]}>
							<TrailingField title="Value" value={newValue} onChange={setNewValue} />
							<ErrorText error={error} />
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button label="Cancel" onPress={() => setAdding(false)} modifiers={toolbarSymbol} />
							</ToolbarItem>
							<ToolbarItem placement="confirmationAction">
								<Button
									label="Add"
									onPress={() => {
										const failed = change((current) => addingStringValue(current, path, newValue));
										if (failed === undefined) {
											setAdding(false);
											setNewValue('');
										}
									}}
									modifiers={[disabled(newValue === ''), ...toolbarSymbol]}
								/>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Sheet>
		</AddToolbar>
	);
}

export function ComposeHealthcheckForm({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'healthcheck' }>;
}) {
	const { binding: bindingRef, path, readOnly } = destination;
	const binding = useComposeBinding(bindingRef);
	const [adding, setAdding] = useState(false);
	const fields = fieldNames(binding.text, keyPath(path));
	const scalar = (key: string, title: string, integer = false) =>
		fields.has(key) ? (
			<ComposeScalarField
				key={key}
				bindingRef={bindingRef}
				path={[...path, key]}
				title={title}
				readOnly={readOnly}
				integer={integer}
			/>
		) : null;
	const timing = ['interval', 'timeout', 'start_period', 'start_interval', 'retries', 'disable'];
	return (
		<AddConfigurationToolbar readOnly={readOnly} onAdd={() => setAdding(true)}>
			<Form modifiers={[navigationTitle('Healthcheck'), ...plainTextInput]}>
				{fields.has('test') ? (
					<Section title="Command">
						{ComposeDocument.tryParse(binding.text)?.scalar([...path, 'test']) !== undefined ? (
							<ComposeScalarField
								bindingRef={bindingRef}
								path={[...path, 'test']}
								title="Shell command"
								readOnly={readOnly}
							/>
						) : (
							<TitleLink
								title="Command arguments"
								destination={{
									screen: 'stringList',
									binding: bindingRef,
									readOnly,
									path: [...path, 'test'],
									title: 'Command arguments',
									allowsScalar: false,
									environmentFiles: false
								}}
							/>
						)}
					</Section>
				) : null}
				{timing.some((key) => fields.has(key)) ? (
					<Section title="Timing">
						{scalar('interval', 'Interval')}
						{scalar('timeout', 'Timeout')}
						{scalar('start_period', 'Start period')}
						{scalar('start_interval', 'Start interval')}
						{scalar('retries', 'Retries', true)}
						{fields.has('disable') ? (
							<ComposeBooleanField
								bindingRef={bindingRef}
								path={[...path, 'disable']}
								title="Disable"
								readOnly={readOnly}
							/>
						) : null}
					</Section>
				) : null}
				{fields.size === 0 ? (
					<ContentUnavailableView
						title="No healthcheck settings"
						systemImage="heart.text.clipboard"
					/>
				) : (
					<TitleLink
						title="All healthcheck settings"
						destination={nativeFieldsDestination(
							bindingRef,
							path,
							'Healthcheck settings',
							readOnly
						)}
					/>
				)}
			</Form>
			<ComposeAddFieldsSheet
				isPresented={adding}
				onDismiss={() => setAdding(false)}
				bindingRef={bindingRef}
				fieldPath={keyPath(path)}
			/>
		</AddConfigurationToolbar>
	);
}

export function ComposeNetworkAttachmentsForm({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'networkAttachments' }>;
}) {
	const { binding: bindingRef, path, readOnly } = destination;
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const binding = useComposeBinding(bindingRef);
	const [name, setName] = useState('');
	const [adding, setAdding] = useState(false);
	const [showResources, setShowResources] = useState(false);
	const [externalResource, setExternalResource] = useState<string>();
	const [error, setError] = useState<string>();
	const names = attachmentNames(ComposeDocument.tryParse(binding.text), path);
	const attachmentRef = withTransform(bindingRef, { kind: 'attachments', path });

	const change = (action: (document: ComposeDocument) => string) => {
		if (readOnly) return 'readOnly';
		const result = attempt(binding.text, action);
		if ('text' in result) {
			binding.setText(result.text);
			setError(undefined);
			return undefined;
		}
		setError(result.error);
		return result.error;
	};

	const rows = (names ?? []).map((key, index) => (
		<ComposeLink
			key={`${index}-${key}`}
			destination={{
				screen: 'networkAttachment',
				binding: attachmentRef,
				readOnly,
				path,
				name: key
			}}
		>
			<Text>{key}</Text>
		</ComposeLink>
	));

	return (
		<AddToolbar
			show={!readOnly && names !== undefined}
			onAdd={() => {
				setName('');
				setExternalResource(undefined);
				setError(undefined);
				setAdding(true);
			}}
		>
			<Form modifiers={[navigationTitle('Networks'), ...plainTextInput]}>
				{names !== undefined ? (
					<Section title="Network attachments">
						{readOnly ? (
							rows
						) : (
							<RowsForEach
								onDelete={(indices) =>
									change(() => removingAttachments(binding.text, path, names, indices))
								}
							>
								{rows}
							</RowsForEach>
						)}
					</Section>
				) : (
					<TitleLink
						title="Network settings"
						destination={nativeFieldsDestination(bindingRef, path, 'Network settings', readOnly)}
					/>
				)}
				<ErrorText error={error} />
			</Form>
			<Sheet isPresented={adding} onDismiss={() => setAdding(false)}>
				<NavigationStack>
					<VStack spacing={0}>
						<Toolbar>
							<Form modifiers={[navigationTitle('Add network'), ...plainTextInput]}>
								<VStack alignment="leading">
									<Text
										modifiers={[
											font({ textStyle: 'caption' }),
											foregroundStyle({ type: 'hierarchical', style: 'secondary' })
										]}
									>
										Network name
									</Text>
									<BoundField placeholder="Network name" value={name} onChange={setName} />
								</VStack>
								<Button label="Choose existing network" onPress={() => setShowResources(true)} />
								<ErrorText error={error} />
							</Form>
							<Toolbar.Content>
								<ToolbarItem placement="cancellationAction">
									<Button
										label="Cancel"
										onPress={() => setAdding(false)}
										modifiers={toolbarSymbol}
									/>
								</ToolbarItem>
								<ToolbarItem placement="confirmationAction">
									<Button
										label="Add"
										onPress={() => {
											const failed = change((current) =>
												addingAttachment(current, path, name, names ?? [], externalResource)
											);
											if (failed === undefined) {
												setAdding(false);
												setName('');
											}
										}}
										modifiers={[disabled(!validName(name)), ...toolbarSymbol]}
									/>
								</ToolbarItem>
							</Toolbar.Content>
						</Toolbar>
						<Sheet isPresented={showResources} onDismiss={() => setShowResources(false)}>
							<ComposeResourcePicker
								kind="network"
								selection={name}
								onSelect={(selected) => {
									setName(selected);
									setExternalResource(selected);
								}}
								dismiss={() => setShowResources(false)}
							/>
						</Sheet>
					</VStack>
				</NavigationStack>
			</Sheet>
		</AddToolbar>
	);
}

export function ComposeNetworkAttachmentDetail({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'networkAttachment' }>;
}) {
	const { binding: bindingRef, path, name, readOnly } = destination;
	const binding = useComposeBinding(bindingRef);
	const [adding, setAdding] = useState(false);
	const detailPath = [...path, name];
	const fields = fieldNames(binding.text, keyPath(detailPath));
	const scalar = (key: string, title: string, integer = false) =>
		fields.has(key) ? (
			<ComposeScalarField
				key={key}
				bindingRef={bindingRef}
				path={[...detailPath, key]}
				title={title}
				readOnly={readOnly}
				integer={integer}
			/>
		) : null;
	return (
		<AddConfigurationToolbar readOnly={readOnly} onAdd={() => setAdding(true)}>
			<Form modifiers={[navigationTitle(name), ...plainTextInput]}>
				{['ipv4_address', 'ipv6_address', 'mac_address', 'interface_name'].some((key) =>
					fields.has(key)
				) ? (
					<Section title="Addresses">
						{scalar('ipv4_address', 'IPv4 address')}
						{scalar('ipv6_address', 'IPv6 address')}
						{scalar('mac_address', 'MAC address')}
						{scalar('interface_name', 'Interface name')}
					</Section>
				) : null}
				{['aliases', 'priority', 'gw_priority'].some((key) => fields.has(key)) ? (
					<Section title="Options">
						{fields.has('aliases') ? (
							<TitleLink
								title="Aliases"
								destination={{
									screen: 'stringList',
									binding: bindingRef,
									readOnly,
									path: [...detailPath, 'aliases'],
									title: 'Aliases',
									allowsScalar: false,
									environmentFiles: false
								}}
							/>
						) : null}
						{scalar('priority', 'Priority', true)}
						{scalar('gw_priority', 'Gateway priority', true)}
					</Section>
				) : null}
				{fields.size === 0 ? (
					<ContentUnavailableView title="No attachment settings" systemImage="network" />
				) : (
					<TitleLink
						title="All network settings"
						destination={nativeFieldsDestination(
							bindingRef,
							detailPath,
							'Network settings',
							readOnly
						)}
					/>
				)}
			</Form>
			<ComposeAddFieldsSheet
				isPresented={adding}
				onDismiss={() => setAdding(false)}
				bindingRef={bindingRef}
				fieldPath={keyPath(detailPath)}
			/>
		</AddConfigurationToolbar>
	);
}

export function ComposeEnvironmentFileEntry({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'envFile' }>;
}) {
	const { binding: bindingRef, readOnly, schemaPath } = destination;
	const binding = useComposeBinding(bindingRef);
	const [adding, setAdding] = useState(false);
	const fields = fieldNames(binding.text, []);
	return (
		<AddConfigurationToolbar readOnly={readOnly} onAdd={() => setAdding(true)}>
			<Form modifiers={[navigationTitle('Environment file'), ...plainTextInput]}>
				{fields.has('path') ? (
					<ComposeScalarField
						bindingRef={bindingRef}
						path={['path']}
						title="Path"
						readOnly={readOnly}
					/>
				) : null}
				{fields.has('required') ? (
					<ComposeBooleanField
						bindingRef={bindingRef}
						path={['required']}
						title="Required"
						readOnly={readOnly}
						defaultValue
					/>
				) : null}
				{fields.has('format') ? (
					<ComposeScalarField
						bindingRef={bindingRef}
						path={['format']}
						title="Format"
						readOnly={readOnly}
					/>
				) : null}
				{fields.size === 0 ? (
					<ContentUnavailableView title="No environment file settings" systemImage="doc.text" />
				) : (
					<TitleLink
						title="All file settings"
						destination={nativeFieldsDestination(
							bindingRef,
							[],
							'Environment file settings',
							readOnly,
							[],
							schemaPath
						)}
					/>
				)}
			</Form>
			<ComposeAddFieldsSheet
				isPresented={adding}
				onDismiss={() => setAdding(false)}
				bindingRef={bindingRef}
				fieldPath={[]}
				schemaPath={schemaPath}
			/>
		</AddConfigurationToolbar>
	);
}
