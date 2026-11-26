import { AdvancedGate } from '@/features/navigation/advanced-gate';
import { Host } from '@/ui/host';
import {
	Button,
	ContextMenu,
	Form,
	HStack,
	Label,
	List,
	NavigationStack,
	Section,
	Spacer,
	SwipeActions,
	Text,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import {
	contentShape,
	disabled,
	font,
	foregroundStyle,
	layoutPriority,
	lineLimit,
	listStyle,
	navigationBarTitleDisplayMode,
	navigationTitle,
	refreshable,
	scrollEdgeEffectStyle,
	shapes,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import type { PodmanSecret } from '@/sdk/models/podman/PodmanSecret';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { AppToolbar } from '@/ui/app-toolbar';
import { FormSecureField, FormTextField } from '@/ui/components/form-fields';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { stableItemKey } from '@/ui/components/stable-sectioned-list.types';
import { sheetGlassModifiers } from '@/ui/components/swiftui-surfaces';
import { useToolbarIcons } from '@/ui/toolbar-icon';

import { SwarmListState } from '@/features/swarm/swarm-parts';

import { PodmanMenuItems } from './podman-pods-screens';
import {
	usePodmanSecretForm,
	usePodmanSecrets,
	type PodmanSecretsModel
} from './use-podman-secrets';

function SecretRow({ model, secret }: { model: PodmanSecretsModel; secret: PodmanSecret }) {
	const actions = model.menuActions(secret);
	const row = (
		<HStack spacing={12} modifiers={[contentShape(shapes.rectangle())]}>
			<RowIcon systemImage="key.fill" identity={secret.id} />
			<VStack alignment="leading" spacing={3} modifiers={[layoutPriority(1)]}>
				<Text modifiers={[font({ textStyle: 'body' }), lineLimit(1)]}>{secret.name}</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						lineLimit(1)
					]}
				>
					{model.subtitle(secret)}
				</Text>
			</VStack>
			<Spacer />
		</HStack>
	);
	const menu =
		actions.length > 0 ? (
			<ContextMenu>
				<ContextMenu.Trigger>{row}</ContextMenu.Trigger>
				<ContextMenu.Items>
					<PodmanMenuItems actions={actions} />
				</ContextMenu.Items>
			</ContextMenu>
		) : (
			row
		);
	if (!model.canDelete) return <VStack>{menu}</VStack>;
	return (
		<SwipeActions>
			{menu}
			<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
				<Button
					label="Remove"
					systemImage="trash"
					onPress={() => model.requestDelete(secret)}
					modifiers={[tint(systemColors.red)]}
				/>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

export function PodmanSecretsScreen() {
	const model = usePodmanSecrets();
	const { snapshot, items } = model;
	const accent = useAccentColor();
	const icon = useToolbarIcons(['plus']);
	return (
		<>
			<Stack.Screen
				options={{
					title: 'Secrets',
					headerSearchBarOptions: {
						placeholder: 'Search secrets',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			{model.canCreate ? (
				<AppToolbar placement="right" tintColor={accent}>
					<AppToolbar.Button
						icon={icon('plus')}
						accessibilityLabel="Create Secret"
						onPress={model.openCreate}
					/>
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>
				<SwarmListState
					isLoading={snapshot.isLoading}
					isEmpty={items.length === 0}
					errorMessage={snapshot.errorMessage}
					emptyTitle={model.emptyTitle}
					emptySystemImage="key"
					retry={() => void model.load()}
				>
					<List
						modifiers={[
							listStyle('insetGrouped'),
							scrollEdgeEffectStyle('soft', 'top'),
							refreshable(model.load)
						]}
					>
						<Section
							header={
								<ResourceCountSectionHeader
									title="Secrets"
									loadedCount={items.length}
									totalCount={snapshot.totalItems}
									hasMore={snapshot.hasMore}
								/>
							}
						>
							<List.ForEach data={items} keyExtractor={stableItemKey} estimatedItemSize={56}>
								{({ item }) => <SecretRow model={model} secret={item.value} />}
							</List.ForEach>
							<PaginatedListFooter
								hasMore={snapshot.hasMore}
								loadMoreError={snapshot.loadMoreError}
								onRetry={() => void model.loadMore()}
								onLoadMore={() => void model.loadMore()}
							/>
						</Section>
					</List>
				</SwarmListState>
			</Host>
		</>
	);
}

function PodmanSecretFormScreenContent() {
	const model = usePodmanSecretForm();
	return (
		<>
			<Stack.Screen options={{ gestureEnabled: !model.dismissDisabled }} />
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[
								...sheetGlassModifiers(),
								disabled(model.isSaving),
								navigationTitle(model.title),
								navigationBarTitleDisplayMode('inline')
							]}
						>
							{!model.isReplacing ? (
								<Section>
									<FormTextField
										title="Name"
										placeholder="db_password"
										text={model.name}
										onChangeText={model.setName}
										autocapitalization="never"
										autocorrectionDisabled
									/>
								</Section>
							) : null}
							<Section footer={<Text>{model.footer}</Text>}>
								<FormSecureField
									title="Value"
									placeholder="Required"
									text={model.data}
									onChangeText={model.setData}
								/>
								<FormTextField
									title="Driver"
									placeholder="file"
									text={model.driver}
									onChangeText={model.setDriver}
									autocapitalization="never"
									autocorrectionDisabled
								/>
							</Section>
							{model.errorMessage ? (
								<Section>
									<Label
										title={model.errorMessage}
										systemImage="exclamationmark.triangle.fill"
										modifiers={[foregroundStyle(systemColors.red), font({ textStyle: 'callout' })]}
									/>
								</Section>
							) : null}
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button
									label="Cancel"
									onPress={model.cancel}
									modifiers={[disabled(model.isSaving)]}
								/>
							</ToolbarItem>
							<ToolbarItem placement="confirmationAction">
								<Button
									label={model.saveTitle}
									onPress={model.save}
									modifiers={[disabled(!model.canSave)]}
								/>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
		</>
	);
}

export function PodmanSecretFormScreen() {
	return (
		<AdvancedGate>
			<PodmanSecretFormScreenContent />
		</AdvancedGate>
	);
}
