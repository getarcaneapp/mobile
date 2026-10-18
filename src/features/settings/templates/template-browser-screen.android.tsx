import { Stack } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import type { Template } from '@/sdk/models/template/Template';
import { withCleanup } from '@/core/with-cleanup';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import {
	GroupedFlashList,
	groupPosition,
	type GroupedListEntry
} from '@/ui/components/grouped-flash-list';
import { ResourceCountLabel } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialSectionHeader } from '@/ui/material/list';

import {
	AndroidToolbar,
	type AndroidMenuItem,
	type AndroidToolbarItem
} from '../shared/android-toolbar';
import { UnavailableView } from '@/ui/components/unavailable-view';

import { TemplateRow } from './template-row';
import {
	templateSourceOptions,
	useTemplateBrowser,
	type TemplateBrowserModel,
	type TemplateGroup
} from './use-template-browser';

const firstHeaderStyle = {
	flexDirection: 'row' as const,
	alignItems: 'center' as const,
	paddingHorizontal: 16,
	paddingTop: 20,
	paddingBottom: 6
};
const pressableRowStyle = {
	flexDirection: 'row' as const,
	alignItems: 'center' as const,
	gap: 8,
	paddingHorizontal: 16,
	paddingVertical: 10
};
const staticRowStyle = { paddingHorizontal: 16, paddingVertical: 10 };
const errorLineStyle = {
	flexDirection: 'row' as const,
	alignItems: 'center' as const,
	gap: 8,
	paddingHorizontal: 32,
	paddingTop: 12
};
const loadingStyle = { padding: 32, alignItems: 'center' as const };
const scrollContentStyle = { flexGrow: 1, paddingBottom: 24 };

type TemplateEntry = GroupedListEntry &
	({ type: 'header'; name: string; isFirstGroup: boolean } | { type: 'item'; template: Template });

function templateEntries(groups: TemplateGroup[]) {
	const entries: TemplateEntry[] = [];
	groups.forEach((group, index) => {
		entries.push({
			type: 'header',
			key: `group:${group.name}`,
			name: group.name,
			isFirstGroup: index === 0
		});
		group.templates.forEach((template, templateIndex) => {
			entries.push({
				type: 'item',
				key: `template:${group.name}:${template.id}`,
				template,
				grouped: groupPosition(templateIndex, group.templates.length)
			});
		});
	});
	return entries;
}

function TemplateListRow({ model, template }: { model: TemplateBrowserModel; template: Template }) {
	if (!model.canReadTemplates) {
		return (
			<View style={staticRowStyle}>
				<TemplateRow template={template} />
			</View>
		);
	}
	return (
		<Pressable
			onPress={() => model.openPreview(template)}
			accessibilityRole="button"
			android_ripple={{ color: colors.separator as string }}
			style={pressableRowStyle}
		>
			<TemplateRow template={template} />
			<Icon name="chevron.right" size={20} color={colors.secondaryLabel} />
		</Pressable>
	);
}

function BrowserState({ model }: { model: TemplateBrowserModel }) {
	if (model.isLoading && model.templates.length === 0) {
		return (
			<View style={loadingStyle}>
				<ArcaneLoadingView label="Loading templates…" />
			</View>
		);
	}
	if (model.errorMessage !== undefined && model.templates.length === 0) {
		return (
			<UnavailableView
				title="Couldn't Load Templates"
				systemImage="exclamationmark.triangle"
				description={model.errorMessage}
				actions={[{ title: 'Try Again', onPress: () => void model.reload() }]}
				fills={false}
			/>
		);
	}
	return (
		<>
			<UnavailableView
				title={model.isUnfiltered ? 'No Templates' : 'No Matching Templates'}
				systemImage="doc.text.magnifyingglass"
				fills={false}
			/>
			<PaginatedListFooter
				hasMore={model.hasMore}
				loadMoreError={model.loadMoreError}
				onRetry={model.loadMore}
				onLoadMore={model.loadMore}
			/>
		</>
	);
}

function TemplateList({
	model,
	tabBar,
	refreshControl
}: {
	model: TemplateBrowserModel;
	tabBar: ReactElement;
	refreshControl: ReactElement;
}) {
	return (
		<GroupedFlashList
			data={templateEntries(model.groupedTemplates)}
			renderEntry={(entry) => {
				if (entry.type === 'item')
					return <TemplateListRow model={model} template={entry.template} />;
				if (!entry.isFirstGroup) return <MaterialSectionHeader title={entry.name} />;
				return (
					<View style={firstHeaderStyle}>
						<Text
							accessibilityRole="header"
							style={[m3Type.titleSmall, { color: colors.secondaryLabel, flex: 1 }]}
						>
							{entry.name}
						</Text>
						<ResourceCountLabel
							loadedCount={model.templates.length}
							totalCount={model.totalItemCount}
							hasMore={model.hasMore}
						/>
					</View>
				);
			}}
			header={tabBar}
			footer={
				<>
					{model.errorMessage !== undefined ? (
						<View style={errorLineStyle}>
							<Icon name="exclamationmark.triangle" size={16} color={systemColors.red} />
							<Text style={[m3Type.bodySmall, { color: systemColors.red, flex: 1 }]}>
								{model.errorMessage}
							</Text>
						</View>
					) : null}
					<PaginatedListFooter
						hasMore={model.hasMore}
						loadMoreError={model.loadMoreError}
						onRetry={model.loadMore}
						onLoadMore={model.loadMore}
					/>
				</>
			}
			onEndReached={model.hasMore && model.loadMoreError === undefined ? model.loadMore : undefined}
			refreshControl={refreshControl}
		/>
	);
}

export function TemplateBrowserScreen({ embedded = false }: { embedded?: boolean }) {
	const model = useTemplateBrowser({ embedded });
	const { permissions } = model;
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = async () => {
		setRefreshing(true);
		await withCleanup(model.refresh, () => setRefreshing(false));
	};

	const refreshControl = (
		<RefreshControl
			refreshing={refreshing}
			onRefresh={() => void onRefresh()}
			colors={[systemColors.blue]}
		/>
	);
	const tabBar = (
		<ScrollableTabBar
			selection={model.source}
			onSelectionChange={model.setSource}
			options={templateSourceOptions}
			accessibilityLabel="Template source"
		/>
	);

	const menuItems: AndroidMenuItem[] = [
		...(permissions.canCreate
			? [{ id: 'create', title: 'Create Template', onPress: model.openCreate }]
			: []),
		...(permissions.canEditDefaults
			? [{ id: 'defaults', title: 'Default Templates', onPress: model.openDefaults }]
			: [])
	];
	const toolbarItems: AndroidToolbarItem[] = [
		...(menuItems.length > 0
			? [
					{
						kind: 'menu' as const,
						id: 'actions',
						icon: 'plus.circle',
						label: 'Template Actions',
						items: menuItems
					}
				]
			: []),
		...(embedded && permissions.canManageRegistries
			? [
					{
						kind: 'button' as const,
						id: 'registries',
						icon: 'gearshape',
						label: 'Manage Template Registries',
						onPress: model.openRegistries
					}
				]
			: [])
	];

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Templates',
					headerSearchBarOptions: {
						placeholder: 'Search templates',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			{toolbarItems.length > 0 ? <AndroidToolbar items={toolbarItems} /> : null}
			{!embedded ? (
				<AndroidToolbar
					placement="left"
					items={[
						{ kind: 'button', id: 'done', icon: 'xmark', label: 'Done', onPress: model.done }
					]}
				/>
			) : null}
			{model.canListTemplates && model.templates.length > 0 ? (
				<TemplateList model={model} tabBar={tabBar} refreshControl={refreshControl} />
			) : (
				<ScrollView
					contentInsetAdjustmentBehavior="automatic"
					style={{ backgroundColor: colors.systemGroupedBackground }}
					contentContainerStyle={scrollContentStyle}
					keyboardShouldPersistTaps="handled"
					refreshControl={refreshControl}
				>
					{!model.canListTemplates ? (
						<UnavailableView
							title="Templates Access Required"
							systemImage="lock.fill"
							description="Your role cannot list templates."
						/>
					) : (
						<>
							{tabBar}
							<BrowserState model={model} />
						</>
					)}
				</ScrollView>
			)}
		</>
	);
}
