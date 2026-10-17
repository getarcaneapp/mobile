import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { ResourceCountLabel } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup, MaterialSectionHeader } from '@/ui/material/list';

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
	type TemplateBrowserModel
} from './use-template-browser';

function BrowserBody({ model }: { model: TemplateBrowserModel }) {
	if (model.isLoading && model.templates.length === 0) {
		return (
			<View style={{ padding: 32, alignItems: 'center' }}>
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
			{model.templates.length === 0 ? (
				<UnavailableView
					title={model.isUnfiltered ? 'No Templates' : 'No Matching Templates'}
					systemImage="doc.text.magnifyingglass"
					fills={false}
				/>
			) : (
				model.groupedTemplates.map((group, index) => (
					<View key={group.name}>
						{index === 0 ? (
							<View
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									paddingHorizontal: 16,
									paddingTop: 20,
									paddingBottom: 6
								}}
							>
								<Text
									accessibilityRole="header"
									style={[m3Type.titleSmall, { color: colors.secondaryLabel, flex: 1 }]}
								>
									{group.name}
								</Text>
								<ResourceCountLabel
									loadedCount={model.templates.length}
									totalCount={model.totalItemCount}
									hasMore={model.hasMore}
								/>
							</View>
						) : (
							<MaterialSectionHeader title={group.name} />
						)}
						<MaterialListGroup>
							{group.templates.map((template) =>
								model.canReadTemplates ? (
									<Pressable
										key={template.id}
										onPress={() => model.openPreview(template)}
										accessibilityRole="button"
										android_ripple={{ color: colors.separator as string }}
										style={{
											flexDirection: 'row',
											alignItems: 'center',
											gap: 8,
											paddingHorizontal: 16,
											paddingVertical: 10
										}}
									>
										<TemplateRow template={template} />
										<Icon name="chevron.right" size={20} color={colors.secondaryLabel} />
									</Pressable>
								) : (
									<View key={template.id} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
										<TemplateRow template={template} />
									</View>
								)
							)}
						</MaterialListGroup>
					</View>
				))
			)}
			{model.errorMessage !== undefined && model.templates.length > 0 ? (
				<View
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						gap: 8,
						paddingHorizontal: 32,
						paddingTop: 12
					}}
				>
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
	);
}

export function TemplateBrowserScreen({ embedded = false }: { embedded?: boolean }) {
	const model = useTemplateBrowser({ embedded });
	const { permissions } = model;
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await model.refresh();
		} finally {
			setRefreshing(false);
		}
	};

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
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
				keyboardShouldPersistTaps="handled"
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => void onRefresh()}
						colors={[systemColors.blue]}
					/>
				}
			>
				{!model.canListTemplates ? (
					<UnavailableView
						title="Templates Access Required"
						systemImage="lock.fill"
						description="Your role cannot list templates."
					/>
				) : (
					<>
						<ScrollableTabBar
							selection={model.source}
							onSelectionChange={model.setSource}
							options={templateSourceOptions}
							accessibilityLabel="Template source"
						/>
						<BrowserBody model={model} />
					</>
				)}
			</ScrollView>
		</>
	);
}
