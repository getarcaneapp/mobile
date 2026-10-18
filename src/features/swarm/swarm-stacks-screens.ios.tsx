import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import {
	Button,
	ContextMenu,
	Form,
	HStack,
	Label,
	List,
	NavigationDestination,
	NavigationLink,
	NavigationStack,
	Picker,
	ProgressView,
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
	autocorrectionDisabled,
	buttonStyle,
	controlSize,
	disabled,
	font,
	foregroundStyle,
	frame,
	listStyle,
	navigationBarTitleDisplayMode,
	navigationTitle,
	pickerStyle,
	refreshable,
	scrollEdgeEffectStyle,
	tag,
	textInputAutocapitalization,
	textSelection,
	tint,
	contentShape,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import { useEffect } from 'react';
import { View } from 'react-native';

import type { SwarmStackSummary } from '@/sdk/models/swarm/SwarmStack';
import { useAccentColor } from '@/theme/accent';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { DeleteConfirmationHost } from '@/ui/components/delete-confirmation';
import { FormTextField } from '@/ui/components/form-fields';
import { DestructiveLabel, ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import { stableItemKey } from '@/ui/components/stable-sectioned-list.types';
import { ResourceActionsToolbar } from '@/ui/components/toolbar';
import { DisclosureChevron } from '@/ui/settings-row';
import { useToolbarIcons } from '@/ui/toolbar-icon';

import { BoundTextField } from '@/features/containers/swiftui-text-field';

import { swarmDate } from './swarm-common';
import { SwarmListState } from './swarm-parts';
import { EmbeddedSwarmServices } from './swarm-services-view';
import { SwarmTasksList } from './swarm-tasks-view';
import {
	resolveImageOptions,
	stackEditorConfirmationHost,
	useSwarmStackDetail,
	useSwarmStackEditor,
	useSwarmStacks,
	validationSummary,
	type SwarmStackDetailModel,
	type SwarmStackEditorModel,
	type SwarmStacksModel
} from './use-swarm-stacks';

function StackLink({ model, stack }: { model: SwarmStacksModel; stack: SwarmStackSummary }) {
	const link = (
		<ContextMenu>
			<ContextMenu.Trigger>
				<Button
					onPress={() => model.openDetail(stack)}
					modifiers={[buttonStyle('plain'), contentShape(shapes.rectangle())]}
				>
					<HStack>
						<HStack spacing={12}>
							<RowIcon systemImage="square.stack.3d.up.fill" />
							<VStack alignment="leading" spacing={3}>
								<Text>{stack.name}</Text>
								<Text
									modifiers={[
										font({ textStyle: 'caption' }),
										foregroundStyle({ type: 'hierarchical', style: 'secondary' })
									]}
								>
									{model.servicesText(stack)}
								</Text>
							</VStack>
							<Spacer minLength={8} />
							<Text
								modifiers={[
									font({ textStyle: 'caption2' }),
									foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
								]}
							>
								{swarmDate(stack.updatedAt)}
							</Text>
						</HStack>
						<DisclosureChevron />
					</HStack>
				</Button>
			</ContextMenu.Trigger>
			<ContextMenu.Items>
				{model.canManage ? (
					<Button
						role="destructive"
						onPress={() => model.requestDelete(stack)}
						modifiers={[tint(systemColors.red)]}
					>
						<DestructiveLabel text="Delete" />
					</Button>
				) : null}
			</ContextMenu.Items>
		</ContextMenu>
	);
	if (!model.canManage) return link;
	return (
		<SwipeActions>
			{link}
			<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
				<Button
					label="Delete"
					systemImage="trash"
					onPress={() => model.requestDelete(stack)}
					modifiers={[tint(systemColors.red)]}
				/>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

export function SwarmStacksScreen() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const model = useSwarmStacks(envID);
	const { snapshot, items } = model;
	const accent = useAccentColor();
	const icon = useToolbarIcons(['plus']);
	return (
		<>
			<Stack.Screen
				options={{
					title: 'Stacks',
					headerSearchBarOptions: {
						placeholder: 'Search stacks',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			{model.canManage ? (
				<AppToolbar placement="right" tintColor={accent}>
					<Stack.Toolbar.Button
						icon={icon('plus')}
						accessibilityLabel="Deploy Stack"
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
					emptySystemImage="square.stack.3d.up"
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
									title="Stacks"
									loadedCount={items.length}
									totalCount={snapshot.totalItems}
									hasMore={snapshot.hasMore}
								/>
							}
						>
							<List.ForEach data={items} keyExtractor={stableItemKey} estimatedItemSize={44}>
								{({ item }) => <StackLink model={model} stack={item.value} />}
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

function SourceView({ model }: { model: SwarmStackDetailModel }) {
	const { loadSource } = model;
	useEffect(() => {
		void loadSource();
	}, [loadSource]);
	if (model.source) {
		return (
			<List modifiers={[listStyle('insetGrouped')]}>
				<Section title="compose.yaml">
					<Text
						modifiers={[font({ textStyle: 'caption', design: 'monospaced' }), textSelection(true)]}
					>
						{model.source.composeContent}
					</Text>
				</Section>
				{model.source.envContent ? (
					<Section title=".env">
						<Text
							modifiers={[
								font({ textStyle: 'caption', design: 'monospaced' }),
								textSelection(true)
							]}
						>
							{model.source.envContent}
						</Text>
					</Section>
				) : null}
			</List>
		);
	}
	if (model.sourceError !== undefined) {
		return (
			<UnavailableView
				title="Source Unavailable"
				systemImage="doc.text"
				description={model.sourceError}
				actions={[{ title: 'Try Again', onPress: () => void model.loadSource() }]}
			/>
		);
	}
	return (
		<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
			<ArcaneLoadingViewSwiftUI label="Loading…" />
		</VStack>
	);
}

export function SwarmStackDetailScreen() {
	const model = useSwarmStackDetail();
	return (
		<>
			<Stack.Screen
				options={{
					title: model.name,
					headerLargeTitleEnabled: false,
					headerTransparent: false,
					headerShadowVisible: false,
					headerStyle: { backgroundColor: colors.systemGroupedBackground }
				}}
			/>
			<ResourceActionsToolbar
				primary={model.toolbar.primary}
				overflow={model.toolbar.overflow}
				runningItemID={model.toolbar.runningItemID}
				isDisabled={model.toolbar.isDisabled}
				resourceName={model.name}
				active={model.canManage}
			/>
			<View style={{ flex: 1 }}>
				<ScrollableTabBar
					selection={model.selectedTab}
					onSelectionChange={model.setSelectedTab}
					options={model.tabs}
					accessibilityLabel="Stack detail sections"
				/>
				<View style={{ flex: 1 }}>
					{model.selectedTab === 'services' ? (
						<EmbeddedSwarmServices environmentID={model.environmentID} stackName={model.name} />
					) : null}
					{model.selectedTab === 'tasks' ? (
						<Host style={{ flex: 1 }}>
							<SwarmTasksList
								environmentID={model.environmentID}
								source={{ kind: 'stack', name: model.name }}
							/>
						</Host>
					) : null}
					{model.selectedTab === 'source' ? (
						<Host style={{ flex: 1 }}>
							<SourceView model={model} />
						</Host>
					) : null}
				</View>
			</View>
		</>
	);
}

function FileEditor({
	model,
	isEnvironment
}: {
	model: SwarmStackEditorModel;
	isEnvironment: boolean;
}) {
	return (
		<List
			modifiers={[
				navigationTitle(isEnvironment ? '.env' : 'compose.yaml'),
				navigationBarTitleDisplayMode('inline')
			]}
		>
			<BoundTextField
				placeholder={isEnvironment ? 'KEY=value' : 'services:'}
				value={isEnvironment ? model.environment : model.compose}
				onChangeText={isEnvironment ? model.setEnvironment : model.setCompose}
				axis="vertical"
				modifiers={[
					font({ textStyle: 'caption', design: 'monospaced' }),
					textInputAutocapitalization('never'),
					autocorrectionDisabled(),
					disabled(model.isSaving),
					frame({ minHeight: 320, alignment: 'topLeading' })
				]}
			/>
		</List>
	);
}

export function SwarmStackEditorScreen() {
	const model = useSwarmStackEditor();
	const validation = model.validation;
	return (
		<>
			<Stack.Screen options={{ gestureEnabled: !(model.hasChanges || model.isSaving) }} />
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[
								disabled(model.isSaving),
								navigationTitle(model.title),
								navigationBarTitleDisplayMode('inline')
							]}
						>
							{model.isLoaded ? (
								<>
									{!model.isEditing ? (
										<Section title="Stack">
											<FormTextField
												title="Name"
												placeholder="my-stack"
												text={model.name}
												onChangeText={model.setName}
												autocapitalization="never"
												autocorrectionDisabled
											/>
										</Section>
									) : null}
									<Section title="Files">
										<NavigationLink value="compose">
											<Text>Compose file</Text>
										</NavigationLink>
										<NavigationLink value="env">
											<Text>Environment variables</Text>
										</NavigationLink>
										<Button
											onPress={model.validate}
											modifiers={[disabled(model.isValidating || model.compose === '')]}
										>
											<HStack>
												<Label title="Validate" systemImage="checkmark.seal" />
												{model.isValidating ? (
													<>
														<Spacer />
														<ProgressView modifiers={[controlSize('small')]} />
													</>
												) : null}
											</HStack>
										</Button>
									</Section>
									{validation ? (
										<Section title="Validation">
											<Label
												title={validationSummary(validation)}
												systemImage="checkmark.circle.fill"
												modifiers={[foregroundStyle(systemColors.green)]}
											/>
											{(validation.warnings ?? []).map((warning) => (
												<Label
													key={warning}
													title={warning}
													systemImage="exclamationmark.triangle"
													modifiers={[
														foregroundStyle(systemColors.orange),
														font({ textStyle: 'callout' })
													]}
												/>
											))}
										</Section>
									) : null}
									<Section header={<Text>Deploy</Text>}>
										{model.isEditing ? (
											<Toggle
												label="Redeploy After Saving"
												isOn={model.redeploy}
												onIsOnChange={model.setRedeploy}
											/>
										) : null}
										{model.showsDeployOptions ? (
											<>
												<Toggle
													label="Prune Removed Services"
													isOn={model.prune}
													onIsOnChange={model.setPrune}
												/>
												<Toggle
													label="Send Registry Auth"
													isOn={model.withRegistryAuth}
													onIsOnChange={model.setWithRegistryAuth}
												/>
												<Picker
													label="Resolve Image"
													selection={model.resolveImage}
													onSelectionChange={model.setResolveImage}
													modifiers={[pickerStyle('menu')]}
												>
													{resolveImageOptions.map((option) => (
														<Text key={option.value} modifiers={[tag(option.value)]}>
															{option.label}
														</Text>
													))}
												</Picker>
											</>
										) : null}
									</Section>
								</>
							) : model.errorMessage === undefined ? (
								<ArcaneLoadingViewSwiftUI label="Loading stack…" />
							) : null}
							{model.errorMessage ? (
								<Section>
									<Label
										title={model.errorMessage}
										systemImage="exclamationmark.triangle.fill"
										modifiers={[foregroundStyle(systemColors.red), font({ textStyle: 'callout' })]}
									/>
									{!model.isLoaded ? <Button label="Try Again" onPress={model.load} /> : null}
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
									modifiers={[disabled(!model.canSave || model.isSaving)]}
								/>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
					<NavigationDestination value="compose">
						<FileEditor model={model} isEnvironment={false} />
					</NavigationDestination>
					<NavigationDestination value="env">
						<FileEditor model={model} isEnvironment />
					</NavigationDestination>
				</NavigationStack>
			</Host>
			<DeleteConfirmationHost hostID={stackEditorConfirmationHost} />
		</>
	);
}
