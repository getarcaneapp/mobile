import { Host } from '@/ui/host';
import { Button, Group, HStack, Label, List, RNHostView, Section, Text } from '@expo/ui/swift-ui';
import {
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	frame,
	listRowBackground,
	listRowInsets,
	listRowSeparator,
	listStyle,
	refreshable,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import { stableItemKey } from '@/ui/components/stable-sectioned-list.types';
import { AppToolbar } from '@/ui/components/toolbar';
import { DisclosureChevron } from '@/ui/settings-row';
import type { Template } from '@/sdk/models/template/Template';

import { UnavailableView } from '@/ui/components/unavailable-view';

import { TemplateRow } from './template-row';
import {
	templateSourceOptions,
	useTemplateBrowser,
	type TemplateBrowserModel,
	type TemplateGroup
} from './use-template-browser';

const clearRow = listRowBackground('#00000000');
const tabBarRowModifiers = [
	listRowInsets({ top: 4, leading: 0, bottom: 4, trailing: 0 }),
	clearRow,
	listRowSeparator('hidden')
];

function TemplateLink({ model, template }: { model: TemplateBrowserModel; template: Template }) {
	if (!model.canReadTemplates) return <TemplateRow template={template} />;
	return (
		<Button onPress={() => model.openPreview(template)} modifiers={[buttonStyle('plain')]}>
			<HStack modifiers={[contentShape(shapes.rectangle())]}>
				<TemplateRow template={template} />
				<DisclosureChevron />
			</HStack>
		</Button>
	);
}

function TemplateGroupSection({
	model,
	group,
	isFirst
}: {
	model: TemplateBrowserModel;
	group: TemplateGroup;
	isFirst: boolean;
}) {
	return (
		<Section
			header={
				isFirst ? (
					<ResourceCountSectionHeader
						title={group.name}
						loadedCount={model.templates.length}
						totalCount={model.totalItemCount}
						hasMore={model.hasMore}
					/>
				) : (
					<Text>{group.name}</Text>
				)
			}
		>
			<List.ForEach data={group.templates} keyExtractor={stableItemKey} estimatedItemSize={72}>
				{({ item }) => <TemplateLink model={model} template={item} />}
			</List.ForEach>
		</Section>
	);
}

function BrowserContent({ model }: { model: TemplateBrowserModel }) {
	if (!model.canListTemplates) {
		return (
			<Section modifiers={[clearRow]}>
				<UnavailableView
					title="Templates Access Required"
					systemImage="lock.fill"
					description="Your role cannot list templates."
					fills={false}
				/>
			</Section>
		);
	}
	let body;
	if (model.isLoading && model.templates.length === 0) {
		body = (
			<Section modifiers={[clearRow]}>
				<ArcaneLoadingViewSwiftUI label="Loading templates…" fillsWidth />
			</Section>
		);
	} else if (model.errorMessage !== undefined && model.templates.length === 0) {
		body = (
			<Section modifiers={[clearRow]}>
				<UnavailableView
					title="Couldn't Load Templates"
					systemImage="exclamationmark.triangle"
					description={model.errorMessage}
					actions={[{ title: 'Try Again', onPress: () => void model.reload() }]}
					fills={false}
				/>
			</Section>
		);
	} else {
		body = (
			<>
				{model.templates.length === 0 ? (
					<Section modifiers={[clearRow]}>
						<UnavailableView
							title={model.isUnfiltered ? 'No Templates' : 'No Matching Templates'}
							systemImage="doc.text.magnifyingglass"
							fills={false}
						/>
					</Section>
				) : (
					model.groupedTemplates.map((group, index) => (
						<TemplateGroupSection
							key={group.name}
							model={model}
							group={group}
							isFirst={index === 0}
						/>
					))
				)}
				{model.errorMessage !== undefined && model.templates.length > 0 ? (
					<Section>
						<Label
							title={model.errorMessage}
							systemImage="exclamationmark.triangle"
							modifiers={[font({ textStyle: 'footnote' }), foregroundStyle(systemColors.red)]}
						/>
					</Section>
				) : null}
				{model.hasMore ? (
					<Section>
						<PaginatedListFooter
							hasMore={model.hasMore}
							loadMoreError={model.loadMoreError}
							onRetry={model.loadMore}
							onLoadMore={model.loadMore}
						/>
					</Section>
				) : null}
			</>
		);
	}
	return (
		<>
			<Section>
				<Group modifiers={tabBarRowModifiers}>
					<RNHostView matchContents={{ vertical: true }}>
						<View style={{ width: '100%' }}>
							<ScrollableTabBar
								selection={model.source}
								onSelectionChange={model.setSource}
								options={templateSourceOptions}
								accessibilityLabel="Template source"
							/>
						</View>
					</RNHostView>
				</Group>
			</Section>
			{body}
		</>
	);
}

export function TemplateBrowserScreen({ embedded = false }: { embedded?: boolean }) {
	const model = useTemplateBrowser({ embedded });
	const { permissions } = model;

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Templates',
					headerLargeTitleEnabled: true,
					headerSearchBarOptions: {
						placeholder: 'Search templates',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			<AppToolbar>
				{permissions.canCreate || permissions.canEditDefaults ? (
					<Stack.Toolbar.Menu icon="plus.circle" accessibilityLabel="Template Actions">
						{permissions.canCreate ? (
							<Stack.Toolbar.MenuAction icon="plus" onPress={model.openCreate}>
								Create Template
							</Stack.Toolbar.MenuAction>
						) : null}
						{permissions.canEditDefaults ? (
							<Stack.Toolbar.MenuAction icon="doc.badge.gearshape" onPress={model.openDefaults}>
								Default Templates
							</Stack.Toolbar.MenuAction>
						) : null}
					</Stack.Toolbar.Menu>
				) : null}
				{embedded && permissions.canManageRegistries ? (
					<Stack.Toolbar.Button
						icon="gearshape"
						accessibilityLabel="Manage Template Registries"
						onPress={model.openRegistries}
					/>
				) : null}
			</AppToolbar>
			{!embedded ? (
				<AppToolbar placement="left">
					<Stack.Toolbar.Button onPress={model.done}>Done</Stack.Toolbar.Button>
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>
				<List
					modifiers={[
						listStyle('insetGrouped'),
						refreshable(model.refresh),
						frame({ maxWidth: Infinity, maxHeight: Infinity })
					]}
				>
					<BrowserContent model={model} />
				</List>
			</Host>
		</>
	);
}
