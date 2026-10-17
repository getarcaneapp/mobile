import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import type { TemplateRegistry } from '@/sdk/models/template/Template';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { ResourceCountLabel } from '@/ui/components/labels';
import { m3 } from '@/ui/components/material-colors';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { AndroidToolbar } from '../shared/android-toolbar';
import { LongPressMenu, type RowMenuItem } from '../shared/long-press-menu';
import { UnavailableView } from '@/ui/components/unavailable-view';

import {
	communityRegistryURL,
	useTemplateRegistries,
	type TemplateRegistriesModel
} from './use-template-registries';

export function TemplateRegistryRow({ registry }: { registry: TemplateRegistry }) {
	return (
		<View
			style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1, paddingVertical: 2 }}
		>
			<RowIcon systemImage="doc.text.fill" tint={systemColors.indigo} />
			<View style={{ flex: 1, gap: 3 }}>
				<Text style={[m3Type.titleMedium, { color: colors.label }]}>{registry.name}</Text>
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>{registry.url}</Text>
				{registry.lastFetchError ? (
					<Text style={[m3Type.labelSmall, { color: systemColors.red }]}>
						{registry.lastFetchError}
					</Text>
				) : null}
			</View>
			{!registry.enabled ? (
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>Disabled</Text>
			) : null}
		</View>
	);
}

function rowMenuItems(model: TemplateRegistriesModel, registry: TemplateRegistry): RowMenuItem[] {
	return [
		...(model.canUpdateRegistries
			? [{ id: 'edit', title: 'Edit', onPress: () => model.openEdit(registry) }]
			: []),
		...(model.canDeleteRegistries
			? [
					{
						id: 'delete',
						title: 'Delete',
						destructive: true,
						onPress: () => model.requestDelete(registry)
					}
				]
			: [])
	];
}

export function TemplateRegistriesScreen() {
	const model = useTemplateRegistries();
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await model.refresh();
		} finally {
			setRefreshing(false);
		}
	};

	let content;
	if (!model.canViewRegistries) {
		content = (
			<UnavailableView
				title="Permission Required"
				systemImage="lock.fill"
				description="Your role cannot view template registries."
			/>
		);
	} else if (model.isLoading && model.registries.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading template registries..." />
			</View>
		);
	} else if (model.errorMessage !== undefined && model.registries.length === 0) {
		content = (
			<UnavailableView
				title="Couldn't Load Template Registries"
				systemImage="exclamationmark.triangle"
				description={model.errorMessage}
				actions={[{ title: 'Try Again', onPress: model.retry }]}
			/>
		);
	} else if (model.registries.length === 0) {
		content = (
			<UnavailableView
				title="No Template Registries"
				systemImage="doc.text"
				description="Add a registry to browse and deploy ready-made project templates."
				actions={
					model.canCreateRegistries
						? [
								{
									title: 'Add Community Registry',
									onPress: model.addCommunityRegistry,
									disabled: model.isAddingCommunity,
									isBusy: model.isAddingCommunity
								},
								{ title: 'Add Custom Registry', onPress: model.openCreate }
							]
						: []
				}
			/>
		);
	} else {
		content = (
			<View>
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
						Template Registries
					</Text>
					<ResourceCountLabel loadedCount={model.registries.length} />
				</View>
				<MaterialListGroup>
					{model.registries.map((registry) => (
						<LongPressMenu
							key={registry.id}
							title={registry.name}
							items={rowMenuItems(model, registry)}
							onPress={model.canUpdateRegistries ? () => model.openEdit(registry) : undefined}
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								minHeight: 72,
								paddingHorizontal: 16,
								paddingVertical: 10
							}}
						>
							<TemplateRegistryRow registry={registry} />
						</LongPressMenu>
					))}
				</MaterialListGroup>
				{model.canCreateRegistries && !model.hasCommunityRegistry ? (
					<View style={{ marginTop: 24 }}>
						<MaterialListGroup>
							<Pressable
								onPress={model.addCommunityRegistry}
								disabled={model.isAddingCommunity}
								accessibilityRole="button"
								android_ripple={{ color: colors.separator as string }}
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									gap: 16,
									minHeight: 56,
									paddingHorizontal: 16
								}}
							>
								<Icon name="person.2" size={22} color={m3.primary} />
								<Text style={[m3Type.bodyLarge, { color: m3.primary, flex: 1 }]}>
									Add Community Registry
								</Text>
								{model.isAddingCommunity ? (
									<ActivityIndicator color={m3.primary as string} />
								) : null}
							</Pressable>
						</MaterialListGroup>
						<Text
							style={[
								m3Type.bodySmall,
								{ color: colors.secondaryLabel, paddingHorizontal: 32, paddingTop: 6 }
							]}
						>
							{`Official Arcane community templates (${communityRegistryURL}).`}
						</Text>
					</View>
				) : null}
			</View>
		);
	}

	return (
		<>
			<Stack.Screen options={{ title: 'Template Registries' }} />
			{model.canCreateRegistries ? (
				<AndroidToolbar
					items={[
						{
							kind: 'button',
							id: 'add',
							icon: 'plus',
							label: 'Add Template Registry',
							onPress: model.openCreate
						}
					]}
				/>
			) : null}
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => void onRefresh()}
						colors={[systemColors.blue]}
					/>
				}
			>
				{content}
			</ScrollView>
		</>
	);
}
