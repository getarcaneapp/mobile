/**
 * Port of `DynamicResourceListView` + `DynamicResourceRow`
 * (DynamicResourceViews.swift).
 */
import { Host } from '@/ui/host';
import { AlertAnchor } from '@/ui/components/alert-anchor';
import { UnavailableView } from '@/ui/components/unavailable-view';
import {
	Alert,
	Button,
	ContentUnavailableView,
	ContextMenu,
	HStack,
	Label,
	List,
	Section,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import {
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	frame,
	listStyle,
	refreshable,
	shapes,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useEnvironmentRowColor } from '@/features/containers/hooks';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import {
	EnvironmentLabel,
	EnvironmentLoadFailuresSection
} from '@/ui/components/environment-label';
import { DestructiveLabel, ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { environmentActionIsMenu, environmentTitle } from '@/ui/components/environment-label.types';
import { DisclosureChevron } from '@/ui/settings-row';

import { DynamicResource, type BackendListAction } from './dynamic-resource';
import {
	useDynamicResourceList,
	type DynamicResourceItem,
	type DynamicResourceListConfig,
	type DynamicResourceListModel
} from './use-dynamic-resource-list';

/** `backendActionLabel(_:)`. */
export function BackendActionButton({
	action,
	onPress
}: {
	action: BackendListAction;
	onPress: () => void;
}) {
	if (action.destructive) {
		return (
			<Button role="destructive" onPress={onPress} modifiers={[tint(systemColors.red)]}>
				<DestructiveLabel text={action.title} systemImage={action.systemImage} />
			</Button>
		);
	}
	return (
		<Button label={action.title} systemImage={action.systemImage as SFSymbol} onPress={onPress} />
	);
}

/** Port of `DynamicResourceRow`. SwiftUI-tree. */
export function DynamicResourceRow({
	item,
	systemImage,
	environmentName,
	environmentColor
}: {
	item: DynamicResource;
	systemImage: string;
	environmentName?: string;
	environmentColor?: string;
}) {
	const status = DynamicResource.statusText(item);
	return (
		<HStack spacing={12}>
			<RowIcon systemImage={systemImage} />
			<VStack alignment="leading" spacing={3}>
				<Text modifiers={[font({ textStyle: 'body' })]}>{DynamicResource.title(item)}</Text>
				<Text
					modifiers={[
						font({ textStyle: 'subheadline' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{DynamicResource.subtitle(item)}
				</Text>
				<EnvironmentLabel name={environmentName} color={environmentColor} />
			</VStack>
			<Spacer />
			{status !== undefined ? (
				<Text
					modifiers={[
						font({ textStyle: 'caption', weight: 'semibold' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{status}
				</Text>
			) : null}
		</HStack>
	);
}

function ResourceLink({
	model,
	item
}: {
	model: DynamicResourceListModel;
	item: DynamicResourceItem;
}) {
	const environmentColor = useEnvironmentRowColor(item.environmentID, item.environmentName);
	return (
		<ContextMenu>
			<ContextMenu.Trigger>
				<Button onPress={() => model.openDetail(item)} modifiers={[buttonStyle('plain')]}>
					<HStack modifiers={[contentShape(shapes.rectangle())]}>
						<DynamicResourceRow
							item={item.value}
							systemImage={model.systemImage}
							environmentName={item.environmentName}
							environmentColor={environmentColor}
						/>
						<DisclosureChevron />
					</HStack>
				</Button>
			</ContextMenu.Trigger>
			<ContextMenu.Items>
				{model.canEdit ? (
					<Button label="Edit" systemImage="pencil" onPress={() => model.presentEdit(item)} />
				) : null}
				{model.rowActions.map((action) => (
					<BackendActionButton
						key={action.id}
						action={action}
						onPress={() => model.setSelectedAction({ action, item })}
					/>
				))}
			</ContextMenu.Items>
		</ContextMenu>
	);
}

function ListToolbar({ model }: { model: DynamicResourceListModel }) {
	const accent = useAccentColor();
	const environments = model.listEnvironments;
	return (
		<AppToolbar placement="right" tintColor={accent}>
			<Stack.Toolbar.Button
				icon="arrow.clockwise"
				accessibilityLabel="Refresh"
				onPress={() => void model.load()}
			/>
			{model.managementTitle ? (
				<Stack.Toolbar.Button
					icon="gearshape"
					accessibilityLabel={model.managementTitle}
					onPress={model.openManagement}
				/>
			) : null}
			{model.canCreate && model.showsAllEnvironments && environmentActionIsMenu(environments) ? (
				<Stack.Toolbar.Menu icon="plus" separateBackground accessibilityLabel={model.createTitle}>
					{environments.map((environment) => (
						<Stack.Toolbar.MenuAction
							key={environment.id}
							onPress={() => model.presentCreate(environment.id)}
						>
							{environmentTitle(environment)}
						</Stack.Toolbar.MenuAction>
					))}
				</Stack.Toolbar.Menu>
			) : model.canCreate ? (
				<Stack.Toolbar.Button
					icon="plus"
					separateBackground
					accessibilityLabel={model.createTitle}
					onPress={() =>
						model.presentCreate(model.showsAllEnvironments ? environments[0]?.id : undefined)
					}
				/>
			) : null}
			{model.globalActions.length > 0 ? (
				<Stack.Toolbar.Menu icon="ellipsis.circle" accessibilityLabel="More options">
					{model.globalActions.map((action) => (
						<Stack.Toolbar.MenuAction
							key={action.id}
							icon={action.systemImage as SFSymbol}
							destructive={action.destructive}
							onPress={() => model.setSelectedAction({ action })}
						>
							{action.title}
						</Stack.Toolbar.MenuAction>
					))}
				</Stack.Toolbar.Menu>
			) : null}
		</AppToolbar>
	);
}

/** Port of `DynamicResourceListView`. */
export function DynamicResourceListView(config: DynamicResourceListConfig) {
	const model = useDynamicResourceList(config);
	const { snapshot, items } = model;

	let content;
	if (snapshot.isLoading && items.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading…" />
			</VStack>
		);
	} else if (snapshot.errorMessage !== undefined && items.length === 0) {
		content = (
			<UnavailableView
				title={`Couldn't Load ${model.title}`}
				systemImage="exclamationmark.triangle"
				description={snapshot.errorMessage}
				actions={[{ title: 'Try Again', onPress: () => void model.load() }]}
			/>
		);
	} else if (items.length === 0) {
		content = (
			<ContentUnavailableView
				title={model.emptyTitle}
				systemImage={model.systemImage as SFSymbol}
			/>
		);
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(model.load)]}>
				<EnvironmentLoadFailuresSection
					failures={snapshot.failedEnvironments.map((failure) => ({
						...failure,
						id: failure.environment.id
					}))}
					retry={() => void model.load()}
				/>
				{model.actionMessage !== undefined ? (
					<Section>
						<Label
							title={model.actionMessage}
							systemImage="checkmark.circle"
							modifiers={[foregroundStyle(systemColors.green)]}
						/>
					</Section>
				) : null}
				<Section
					header={
						<ResourceCountSectionHeader
							title={model.title}
							loadedCount={items.length}
							totalCount={snapshot.totalItems}
							hasMore={snapshot.hasMore}
						/>
					}
				>
					{model.displayedItems.map((item) => (
						<ResourceLink key={item.id} model={model} item={item} />
					))}
					<PaginatedListFooter
						hasMore={snapshot.hasMore}
						loadMoreError={snapshot.loadMoreError}
						onRetry={() => void model.loadMore()}
						onLoadMore={() => void model.loadMore()}
					/>
				</Section>
			</List>
		);
	}

	const selected = model.selectedAction;
	return (
		<>
			<Stack.Screen
				options={{
					title: model.title,
					headerSearchBarOptions: {
						placeholder: `Search ${model.title.toLowerCase()}`,
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			<ListToolbar model={model} />
			<Host style={{ flex: 1 }}>
				{content}
				<Alert
					title={selected?.action.title ?? 'Run Action'}
					isPresented={selected !== undefined}
					onIsPresentedChange={(presented) => {
						if (!presented) model.setSelectedAction(undefined);
					}}
				>
					<AlertAnchor />
					<Alert.Actions>
						{selected ? (
							<Button
								label={selected.action.title}
								role={selected.action.destructive ? 'destructive' : undefined}
								onPress={() => void model.run(selected)}
							/>
						) : null}
						<Button
							label="Cancel"
							role="cancel"
							onPress={() => model.setSelectedAction(undefined)}
						/>
					</Alert.Actions>
					<Alert.Message>
						<Text>{model.selectedActionMessage}</Text>
					</Alert.Message>
				</Alert>
			</Host>
		</>
	);
}
