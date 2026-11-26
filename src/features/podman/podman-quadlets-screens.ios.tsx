import { AdvancedGate } from '@/features/navigation/advanced-gate';
import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import {
	Button,
	ContextMenu,
	Form,
	HStack,
	Label,
	LabeledContent,
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
	autocorrectionDisabled,
	buttonStyle,
	contentShape,
	disabled,
	font,
	foregroundStyle,
	frame,
	layoutPriority,
	lineLimit,
	listStyle,
	navigationBarTitleDisplayMode,
	navigationTitle,
	refreshable,
	scrollEdgeEffectStyle,
	shapes,
	textInputAutocapitalization,
	textSelection,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import { PodmanContainer, QuadletDetail } from '@/sdk/models/podman/Quadlet';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { AppToolbar } from '@/ui/app-toolbar';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { FormTextField } from '@/ui/components/form-fields';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { stableItemKey } from '@/ui/components/stable-sectioned-list.types';
import { sheetGlassModifiers } from '@/ui/components/swiftui-surfaces';
import { ResourceActionsToolbar } from '@/ui/components/toolbar';
import { DisclosureChevron } from '@/ui/settings-row';
import { useToolbarIcons } from '@/ui/toolbar-icon';

import { BoundTextField } from '@/features/containers/swiftui-text-field';
import { SwarmListState } from '@/features/swarm/swarm-parts';

import { podmanStateVariant } from './podman-logic';
import { PodmanMenuItems } from './podman-pods-screens';
import { PodmanStateBadge } from './podman-state-badge';
import {
	quadletSubtitle,
	usePodmanQuadletDetail,
	usePodmanQuadletEditor,
	usePodmanQuadlets,
	type PodmanQuadletsModel,
	type QuadletRow as QuadletRowValue
} from './use-podman-quadlets';

function QuadletRow({ model, quadlet }: { model: PodmanQuadletsModel; quadlet: QuadletRowValue }) {
	const state = QuadletDetail.state(quadlet);
	const link = (
		<ContextMenu>
			<ContextMenu.Trigger>
				<Button
					onPress={() => model.openDetail(quadlet)}
					modifiers={[buttonStyle('plain'), contentShape(shapes.rectangle())]}
				>
					<HStack spacing={12}>
						<RowIcon
							systemImage="doc.badge.gearshape"
							tint={podmanStateVariant(state) === 'stopped' ? systemColors.gray : undefined}
							identity={quadlet.name}
						/>
						<VStack alignment="leading" spacing={3} modifiers={[layoutPriority(1)]}>
							<Text modifiers={[font({ textStyle: 'body' }), lineLimit(1)]}>{quadlet.name}</Text>
							<Text
								modifiers={[
									font({ textStyle: 'caption' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
									lineLimit(1)
								]}
							>
								{quadletSubtitle(quadlet)}
							</Text>
						</VStack>
						<Spacer minLength={8} />
						<PodmanStateBadge key={quadlet.name} state={state} />
						<DisclosureChevron />
					</HStack>
				</Button>
			</ContextMenu.Trigger>
			<ContextMenu.Items>
				<PodmanMenuItems actions={model.menuActions(quadlet)} />
			</ContextMenu.Items>
		</ContextMenu>
	);
	if (!model.canDelete) return link;
	return (
		<SwipeActions>
			{link}
			<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
				<Button
					label="Remove"
					systemImage="trash"
					onPress={() => model.requestDelete(quadlet)}
					modifiers={[tint(systemColors.red)]}
				/>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

export function PodmanQuadletsScreen() {
	const model = usePodmanQuadlets();
	const { snapshot, items } = model;
	const accent = useAccentColor();
	const icon = useToolbarIcons(['plus']);
	return (
		<>
			<Stack.Screen
				options={{
					title: 'Quadlets',
					headerSearchBarOptions: {
						placeholder: 'Search quadlets',
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
						accessibilityLabel="Install Quadlet"
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
					emptySystemImage="doc.badge.gearshape"
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
									title="Quadlets"
									loadedCount={items.length}
									totalCount={snapshot.totalItems}
									hasMore={snapshot.hasMore}
								/>
							}
						>
							<List.ForEach data={items} keyExtractor={stableItemKey} estimatedItemSize={56}>
								{({ item }) => <QuadletRow model={model} quadlet={item.value} />}
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

function SecondaryValue({ value, monospaced }: { value: string; monospaced?: boolean }) {
	return (
		<Text
			modifiers={[
				font(monospaced ? { textStyle: 'callout', design: 'monospaced' } : { textStyle: 'body' }),
				foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
				textSelection(true)
			]}
		>
			{value}
		</Text>
	);
}

export function PodmanQuadletDetailScreen() {
	const model = usePodmanQuadletDetail();
	const { detail } = model;
	let content;
	if (detail) {
		content = (
			<List
				modifiers={[
					listStyle('insetGrouped'),
					scrollEdgeEffectStyle('soft', 'top'),
					refreshable(model.load)
				]}
			>
				<Section title="Details">
					<LabeledContent label="State">
						<PodmanStateBadge state={model.state} />
					</LabeledContent>
					{model.details.map((row) => (
						<LabeledContent key={row.title} label={row.title}>
							<SecondaryValue value={row.value} monospaced={row.monospaced} />
						</LabeledContent>
					))}
				</Section>
				{model.unitDetails.length > 0 ? (
					<Section title="systemd Unit">
						{model.unitDetails.map((row) => (
							<LabeledContent key={row.title} label={row.title}>
								<SecondaryValue value={row.value} />
							</LabeledContent>
						))}
					</Section>
				) : null}
				{model.containers.length > 0 ? (
					<Section title="Containers">
						{model.containers.map((container) => (
							<HStack key={container.id} spacing={12}>
								<RowIcon systemImage="cube.box.fill" />
								<VStack alignment="leading" spacing={3} modifiers={[layoutPriority(1)]}>
									<Text modifiers={[lineLimit(1)]}>{PodmanContainer.displayName(container)}</Text>
									<Text
										modifiers={[
											font({ textStyle: 'caption' }),
											foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
											lineLimit(1)
										]}
									>
										{container.image}
									</Text>
								</VStack>
								<Spacer minLength={8} />
								<PodmanStateBadge state={container.state} />
							</HStack>
						))}
					</Section>
				) : null}
				{model.content !== undefined ? (
					<Section title="File">
						<Text
							modifiers={[
								font({ textStyle: 'caption', design: 'monospaced' }),
								textSelection(true)
							]}
						>
							{model.content}
						</Text>
					</Section>
				) : null}
			</List>
		);
	} else if (model.errorMessage !== undefined) {
		content = (
			<UnavailableView
				title="Couldn't Load Quadlet"
				systemImage="exclamationmark.triangle"
				description={model.errorMessage}
				actions={[{ title: 'Try Again', onPress: () => void model.load() }]}
			/>
		);
	} else {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading…" />
			</VStack>
		);
	}
	return (
		<>
			<Stack.Screen options={{ title: model.name, headerLargeTitleEnabled: false }} />
			<ResourceActionsToolbar
				primary={model.toolbar.primary}
				secondary={model.toolbar.secondary}
				overflow={model.toolbar.overflow}
				runningItemID={model.toolbar.runningItemID}
				isDisabled={model.toolbar.isDisabled}
				resourceName={model.name}
			/>
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}

function PodmanQuadletEditorScreenContent() {
	const model = usePodmanQuadletEditor();
	return (
		<>
			<Stack.Screen options={{ gestureEnabled: !(model.hasChanges || model.isSaving) }} />
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
							{!model.isEditing ? (
								<Section footer={model.nameError ? <Text>{model.nameError}</Text> : undefined}>
									<FormTextField
										title="File Name"
										placeholder="web.container"
										text={model.name}
										onChangeText={model.setName}
										autocapitalization="never"
										autocorrectionDisabled
									/>
								</Section>
							) : null}
							<Section title="Contents">
								<BoundTextField
									placeholder="[Container]"
									value={model.content}
									onChangeText={model.setContent}
									axis="vertical"
									modifiers={[
										font({ textStyle: 'caption', design: 'monospaced' }),
										textInputAutocapitalization('never'),
										autocorrectionDisabled(),
										frame({ minHeight: 320, alignment: 'topLeading' })
									]}
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

export function PodmanQuadletEditorScreen() {
	return (
		<AdvancedGate>
			<PodmanQuadletEditorScreenContent />
		</AdvancedGate>
	);
}
