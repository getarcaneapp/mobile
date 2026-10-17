import {
	Button,
	ContentUnavailableView,
	Form,
	HStack,
	Label,
	List,
	NavigationStack,
	Section,
	Spacer,
	Text,
	Toolbar,
	ToolbarItem,
	VStack,
	useNativeState
} from '@expo/ui/swift-ui';
import {
	disabled,
	font,
	foregroundStyle,
	frame,
	navigationBarTitleDisplayMode,
	navigationTitle,
	searchable
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { hasPermission } from '@/core/auth/permissions';
import { Permission } from '@/sdk/models/role/Permission';
import { useClientManager } from '@/stores/client-manager';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { Image } from '@/ui/components/swiftui-image';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';

import { addingResource, fieldNames, removingResources, validName } from '../compose-actions';
import { nativeFieldsDestination, type ComposeDestination } from '../compose-destinations';
import { useComposeBinding } from '../compose-session';
import { ComposeDocument } from '../model/compose-document';
import type { ComposeEntryKind } from '../model/compose-entry-draft';
import { composeErrorMessage } from '../model/compose-errors';
import { keyPath } from '../model/compose-native-field';
import { ComposeBooleanField, ComposeScalarField } from './compose-forms.ios';
import { ComposeAddFieldsSheet } from './compose-native-fields.ios';
import {
	RowsForEach,
	BoundField,
	ComposeLink,
	EllipsisMenu,
	ErrorText,
	plainTextInput,
	Sheet,
	TitleLink
} from './compose-ui.ios';

export function ComposeResourceDefinitionList({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'resourceList' }>;
}) {
	const { binding: bindingRef, kind, readOnly } = destination;
	const binding = useComposeBinding(bindingRef);
	const [adding, setAdding] = useState(false);
	const [name, setName] = useState('');
	const [error, setError] = useState<string>();
	const resourceNames = (
		ComposeDocument.tryParse(binding.text)?.nativeFields([{ key: kind }]) ?? []
	).map((field) => field.name);
	const title = kind === 'networks' ? 'Networks' : 'Named volumes';
	const icon = kind === 'networks' ? 'network' : 'externaldrive';

	const add = () => {
		if (readOnly) return;
		try {
			binding.setText(addingResource(binding.text, kind, name));
			setError(undefined);
			setAdding(false);
		} catch (caught) {
			setError(composeErrorMessage(caught));
		}
	};
	const remove = (indices: number[]) => {
		if (readOnly) return;
		try {
			binding.setText(removingResources(binding.text, kind, indices));
			setError(undefined);
		} catch (caught) {
			setError(composeErrorMessage(caught));
		}
	};

	const rows = resourceNames.map((key) => (
		<ComposeLink
			key={key}
			destination={{ screen: 'resourceForm', binding: bindingRef, readOnly, kind, name: key }}
		>
			<Label title={key} systemImage={icon} />
		</ComposeLink>
	));

	return (
		<Toolbar>
			<VStack spacing={0}>
				<List modifiers={[navigationTitle(title)]}>
					{readOnly ? rows : <RowsForEach onDelete={remove}>{rows}</RowsForEach>}
					{resourceNames.length === 0 ? (
						<ContentUnavailableView title={`No ${title.toLowerCase()}`} systemImage={icon} />
					) : null}
					<ErrorText error={error} />
				</List>
				<AddResourceSheet
					isPresented={adding}
					onDismiss={() => setAdding(false)}
					kind={kind}
					name={name}
					setName={setName}
					error={error}
					add={add}
				/>
			</VStack>
			<Toolbar.Content>
				{!readOnly ? (
					<ToolbarItem placement="primaryAction">
						<Button
							label="Add"
							systemImage="plus"
							onPress={() => {
								setName('');
								setError(undefined);
								setAdding(true);
							}}
						/>
					</ToolbarItem>
				) : null}
			</Toolbar.Content>
		</Toolbar>
	);
}

function AddResourceSheet({
	isPresented,
	onDismiss,
	kind,
	name,
	setName,
	error,
	add
}: {
	isPresented: boolean;
	onDismiss: () => void;
	kind: string;
	name: string;
	setName: (name: string) => void;
	error?: string;
	add: () => void;
}) {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	return (
		<Sheet isPresented={isPresented} onDismiss={onDismiss}>
			<NavigationStack>
				<Toolbar>
					<Form
						modifiers={[
							navigationTitle(kind === 'networks' ? 'Add network' : 'Add volume'),
							...plainTextInput
						]}
					>
						<BoundField placeholder="Name" value={name} onChange={setName} />
						<ErrorText error={error} />
					</Form>
					<Toolbar.Content>
						<ToolbarItem placement="cancellationAction">
							<Button label="Cancel" onPress={onDismiss} modifiers={toolbarSymbol} />
						</ToolbarItem>
						<ToolbarItem placement="confirmationAction">
							<Button
								label="Add"
								onPress={add}
								modifiers={[disabled(!validName(name)), ...toolbarSymbol]}
							/>
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Sheet>
	);
}

export function ComposeResourceDefinitionForm({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'resourceForm' }>;
}) {
	const { binding: bindingRef, kind, name, readOnly } = destination;
	const binding = useComposeBinding(bindingRef);
	const [adding, setAdding] = useState(false);
	const path = [kind, name];
	const fields = fieldNames(binding.text, keyPath(path));
	const any = (keys: string[]) => keys.some((key) => fields.has(key));
	return (
		<Toolbar>
			<VStack spacing={0}>
				<Form modifiers={[navigationTitle(name), ...plainTextInput]}>
					{any(['name', 'external', 'driver']) ? (
						<Section title="Resource">
							{fields.has('name') ? (
								<ComposeScalarField
									bindingRef={bindingRef}
									path={[...path, 'name']}
									title="Docker resource name"
									readOnly={readOnly}
								/>
							) : null}
							{fields.has('external') ? (
								<ComposeBooleanField
									bindingRef={bindingRef}
									path={[...path, 'external']}
									title="External resource"
									readOnly={readOnly}
								/>
							) : null}
							{fields.has('driver') ? (
								<ComposeScalarField
									bindingRef={bindingRef}
									path={[...path, 'driver']}
									title="Driver"
									readOnly={readOnly}
								/>
							) : null}
						</Section>
					) : null}
					{kind === 'networks' &&
					any(['internal', 'attachable', 'enable_ipv4', 'enable_ipv6', 'ipam']) ? (
						<Section title="Network">
							{fields.has('internal') ? (
								<ComposeBooleanField
									bindingRef={bindingRef}
									path={[...path, 'internal']}
									title="Internal"
									readOnly={readOnly}
								/>
							) : null}
							{fields.has('attachable') ? (
								<ComposeBooleanField
									bindingRef={bindingRef}
									path={[...path, 'attachable']}
									title="Attachable"
									readOnly={readOnly}
								/>
							) : null}
							{fields.has('enable_ipv4') ? (
								<ComposeBooleanField
									bindingRef={bindingRef}
									path={[...path, 'enable_ipv4']}
									title="IPv4"
									readOnly={readOnly}
									defaultValue
								/>
							) : null}
							{fields.has('enable_ipv6') ? (
								<ComposeBooleanField
									bindingRef={bindingRef}
									path={[...path, 'enable_ipv6']}
									title="IPv6"
									readOnly={readOnly}
								/>
							) : null}
							{fields.has('ipam') ? (
								<TitleLink
									title="IP address management"
									destination={nativeFieldsDestination(
										bindingRef,
										[...path, 'ipam'],
										'IP address management',
										readOnly
									)}
								/>
							) : null}
						</Section>
					) : null}
					{any(['driver_opts', 'labels']) ? (
						<Section title="Options">
							{fields.has('driver_opts') ? (
								<TitleLink
									title="Driver options"
									destination={nativeFieldsDestination(
										bindingRef,
										[...path, 'driver_opts'],
										'Driver options',
										readOnly
									)}
								/>
							) : null}
							{fields.has('labels') ? (
								<TitleLink
									title="Labels"
									destination={nativeFieldsDestination(
										bindingRef,
										[...path, 'labels'],
										'Labels',
										readOnly
									)}
								/>
							) : null}
						</Section>
					) : null}
					{fields.size === 0 ? (
						<ContentUnavailableView
							title="No resource settings"
							systemImage={kind === 'networks' ? 'network' : 'externaldrive'}
						/>
					) : (
						<TitleLink
							title="All resource settings"
							destination={nativeFieldsDestination(bindingRef, path, 'Resource settings', readOnly)}
						/>
					)}
				</Form>
				<ComposeAddFieldsSheet
					isPresented={adding}
					onDismiss={() => setAdding(false)}
					bindingRef={bindingRef}
					fieldPath={keyPath(path)}
				/>
			</VStack>
			<Toolbar.Content>
				{!readOnly ? (
					<ToolbarItem placement="primaryAction">
						<EllipsisMenu label="Configuration actions">
							<Button
								label="Add configuration"
								systemImage="plus"
								onPress={() => setAdding(true)}
							/>
						</EllipsisMenu>
					</ToolbarItem>
				) : null}
			</Toolbar.Content>
		</Toolbar>
	);
}

const pageSize = 50;

export function ComposeResourcePicker({
	kind,
	selection,
	onSelect,
	dismiss
}: {
	kind: ComposeEntryKind;
	selection: string;
	onSelect: (name: string) => void;
	dismiss: () => void;
}) {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const isVolume = kind === 'mount';
	const environmentID = useClientManager((s) => s.activeEnvironmentID);
	const session = useClientManager((s) => s.cacheSessionIdentity);
	useClientManager((s) => s.accessGeneration);
	const canList =
		(kind === 'mount' || kind === 'network') &&
		hasPermission(isVolume ? Permission.Volumes.list : Permission.Networks.list, environmentID);
	const [search, setSearch] = useState('');
	const searchText = useNativeState('');
	const [names, setNames] = useState<string[]>([]);
	const [total, setTotal] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const generation = useRef(0);
	const queryKey = `${session}|${environmentID}|${canList}|${search}`;
	const [loadedQuery, setLoadedQuery] = useState<string>();

	const load = async (reset: boolean) => {
		const client = useClientManager.getState().client;
		if (!canList || !client) return;
		const requested = queryKey;
		const current = reset ? ++generation.current : generation.current;
		const start = reset ? 0 : names.length;
		setIsLoading(true);
		setErrorMessage(undefined);
		try {
			const query = {
				search: search === '' ? undefined : search,
				start,
				limit: pageSize,
				sortBy: 'name',
				sortOrder: 'asc' as const
			};
			const response = isVolume
				? await client.volumes.list({ envID: environmentID, query })
				: await client.networks.list({ envID: environmentID, query });
			if (current !== generation.current) return;
			const incoming = response.data.map((item) => item.name);
			setNames((existing) => {
				const base = reset ? [] : existing;
				const seen = new Set(base);
				return [...base, ...incoming.filter((name) => !seen.has(name) && (seen.add(name), true))];
			});
			setTotal(response.pagination?.totalItems ?? 0);
			setLoadedQuery(requested);
		} catch (error) {
			if (current === generation.current) setErrorMessage(friendlyErrorMessage(error));
		} finally {
			if (current === generation.current) setIsLoading(false);
		}
	};

	useEffect(() => {
		generation.current += 1;
		setNames([]);
		setIsLoading(false);
		setErrorMessage(undefined);
		setLoadedQuery(undefined);
		if (!canList) return;
		const timer = setTimeout(() => void load(true), 200);
		return () => clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [queryKey]);

	return (
		<NavigationStack>
			<Toolbar>
				<List
					modifiers={[
						navigationTitle(isVolume ? 'Choose Volume' : 'Choose Network'),
						navigationBarTitleDisplayMode('inline'),
						searchable(searchText, { prompt: 'Search names', onChange: setSearch })
					]}
				>
					<Section>
						<Text
							modifiers={[
								font({ textStyle: 'footnote' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>
							The selected resource will be declared external when you apply this entry.
						</Text>
					</Section>
					{!canList ? (
						<ContentUnavailableView
							title="Listing Access Required"
							systemImage="lock.fill"
							description="You can close this picker and enter a name manually."
						/>
					) : (
						<>
							{names.map((name) => (
								<Button
									key={name}
									onPress={() => {
										if (loadedQuery !== queryKey || !canList) return;
										onSelect(name);
										dismiss();
									}}
								>
									<HStack>
										<Label
											title={name}
											systemImage={isVolume ? 'externaldrive' : 'network'}
											modifiers={[foregroundStyle('primary')]}
										/>
										<Spacer />
										{name === selection ? <Image systemName="checkmark" /> : null}
									</HStack>
								</Button>
							))}
							{isLoading ? (
								<ArcaneLoadingViewSwiftUI label="Loading…" />
							) : errorMessage !== undefined ? (
								<Section>
									<Label
										title={errorMessage}
										systemImage="exclamationmark.triangle"
										modifiers={[foregroundStyle(systemColors.red)]}
									/>
									<Button label="Try Again" onPress={() => void load(names.length === 0)} />
								</Section>
							) : names.length === 0 ? (
								<ContentUnavailableView
									title={search === '' ? 'No Results' : `No Results for “${search}”`}
									systemImage="magnifyingglass"
									description="Check the spelling or try a new search."
								/>
							) : names.length < total ? (
								<Button
									label="Load More"
									onPress={() => void load(false)}
									modifiers={[frame({ maxWidth: Infinity })]}
								/>
							) : null}
						</>
					)}
				</List>
				<Toolbar.Content>
					<ToolbarItem placement="cancellationAction">
						<Button label="Cancel" onPress={dismiss} modifiers={toolbarSymbol} />
					</ToolbarItem>
				</Toolbar.Content>
			</Toolbar>
		</NavigationStack>
	);
}
