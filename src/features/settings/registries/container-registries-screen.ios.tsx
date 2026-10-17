/** Port of `ContainerRegistriesView` + `RegistryRow` (ContainerRegistriesView.swift). */
import { Host } from '@/ui/host';
import {
	Button,
	ContextMenu,
	HStack,
	List,
	Section,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import {
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

import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { DestructiveLabel, ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { RowPreviewCard } from '@/ui/components/row-preview-card';

const accentColorAsset = '#AF52DE';
import { AppToolbar } from '@/ui/components/toolbar';
import type { ContainerRegistry } from '@/sdk/models/containerRegistry/ContainerRegistry';

import { ActionErrorAlert } from '../shared/action-error-alert';
import { UnavailableView } from '@/ui/components/unavailable-view';

import {
	registryName,
	registryRowSubtitle,
	registryRowTitle,
	useContainerRegistries,
	type ContainerRegistriesModel
} from './use-container-registries';

export function RegistryRow({ registry }: { registry: ContainerRegistry }) {
	return (
		<HStack spacing={12}>
			<RowIcon systemImage="shippingbox.fill" />
			<VStack alignment="leading" spacing={3}>
				<Text modifiers={[font({ textStyle: 'body' })]}>{registryRowTitle(registry)}</Text>
				<Text
					modifiers={[
						font({ textStyle: 'subheadline' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{registryRowSubtitle(registry)}
				</Text>
			</VStack>
			<Spacer />
			{!registry.enabled ? (
				<Text
					modifiers={[
						font({ textStyle: 'subheadline' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					Disabled
				</Text>
			) : null}
		</HStack>
	);
}

function RegistryActionRow({
	model,
	registry
}: {
	model: ContainerRegistriesModel;
	registry: ContainerRegistry;
}) {
	const accent = useAccentColor();
	return (
		<ContextMenu>
			<ContextMenu.Trigger>
				<Button onPress={() => model.openEdit(registry)}>
					{/* Swift's `.foregroundStyle(.primary)` is hierarchical, so inside the Button it resolves to the
              accent tint (titles render accent, subtitles a dimmed accent); @expo/ui's Button doesn't
              propagate that, so apply the accent directly. */}
					<HStack modifiers={[foregroundStyle(accent), contentShape(shapes.rectangle())]}>
						<RegistryRow registry={registry} />
					</HStack>
				</Button>
			</ContextMenu.Trigger>
			<ContextMenu.Items>
				<Button label="Edit" systemImage="pencil" onPress={() => model.openEdit(registry)} />
				<Button
					role="destructive"
					onPress={() => model.setPendingDeleteRegistry(registry)}
					modifiers={[tint(systemColors.red)]}
				>
					<DestructiveLabel text="Delete" />
				</Button>
			</ContextMenu.Items>
			<ContextMenu.Preview>
				<RowPreviewCard
					icon="shippingbox.fill"
					// Swift passes `.accentColor`; the context-menu preview is hosted outside the app's
					// `.accentColor(_:)` environment, so it resolves to the AccentColor asset (purple).
					iconColor={accentColorAsset}
					title={registryName(registry)}
					badges={[
						{
							text: registry.enabled ? 'Enabled' : 'Disabled',
							color: registry.enabled ? systemColors.green : systemColors.gray
						}
					]}
					details={[{ icon: 'link', label: 'URL', value: registry.url }]}
				/>
			</ContextMenu.Preview>
		</ContextMenu>
	);
}

export function ContainerRegistriesScreen() {
	const model = useContainerRegistries();

	let content;
	if (!model.isAdmin) {
		content = (
			<UnavailableView
				title="Admin Required"
				systemImage="lock.fill"
				description="Only administrators can manage container registries."
			/>
		);
	} else if (model.isLoading && model.registries.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading registries..." />
			</VStack>
		);
	} else if (model.errorMessage !== undefined && model.registries.length === 0) {
		content = (
			<UnavailableView
				title="Couldn't Load Registries"
				systemImage="exclamationmark.triangle"
				description={model.errorMessage}
				actions={[{ title: 'Try Again', onPress: () => void model.loadRegistries() }]}
			/>
		);
	} else if (model.registries.length === 0) {
		content = (
			<UnavailableView
				title="No Container Registries"
				systemImage="shippingbox"
				description="Add a registry to pull private images and check for updates behind authentication."
				actions={[{ title: 'Add Registry', onPress: model.openCreate }]}
			/>
		);
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(model.refresh)]}>
				<Section
					header={
						<ResourceCountSectionHeader
							title="Container Registries"
							loadedCount={model.registries.length}
							totalCount={model.totalItems}
							hasMore={model.hasMore}
						/>
					}
				>
					{model.registries.map((registry) => (
						<RegistryActionRow key={registry.id} model={model} registry={registry} />
					))}
					<PaginatedListFooter
						hasMore={model.hasMore}
						loadMoreError={model.loadMoreError}
						onRetry={() => void model.loadMore()}
						onLoadMore={() => void model.loadMore()}
					/>
				</Section>
			</List>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Container Registries',
					headerSearchBarOptions: {
						placeholder: 'Search registries',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			{model.isAdmin ? (
				<AppToolbar>
					<Stack.Toolbar.Button
						icon="plus"
						accessibilityLabel="Add Registry"
						onPress={model.openCreate}
					/>
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>
				{content}
				<ActionErrorAlert
					title="Couldn't Delete Registry"
					message={model.actionErrorMessage}
					onDismiss={model.dismissActionError}
				/>
			</Host>
		</>
	);
}
