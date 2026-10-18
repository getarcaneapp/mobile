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
	Stepper,
	SwipeActions,
	Text,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import {
	buttonStyle,
	contentShape,
	disabled,
	fixedSize,
	font,
	foregroundStyle,
	labelsHidden,
	layoutPriority,
	lineLimit,
	listStyle,
	monospacedDigit,
	navigationBarTitleDisplayMode,
	navigationTitle,
	refreshable,
	scrollEdgeEffectStyle,
	shapes,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';

import type { EnvironmentID } from '@/sdk/client/environment';
import type { SwarmServiceSummary } from '@/sdk/models/swarm/SwarmServices';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { DestructiveLabel, ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { ImageReferenceLine, RowIcon } from '@/ui/components/row-icon';
import { stableItemKey } from '@/ui/components/stable-sectioned-list.types';
import { DisclosureChevron } from '@/ui/settings-row';
import { useToolbarIcons } from '@/ui/toolbar-icon';

import { SwarmListState } from './swarm-parts';
import {
	serviceIsHealthy,
	serviceModeTitle,
	useSwarmScale,
	useSwarmServices,
	type SwarmServicesModel
} from './use-swarm-services';

export function SwarmServiceRow({
	service,
	showsStack = true
}: {
	service: SwarmServiceSummary;
	showsStack?: boolean;
}) {
	const healthy = serviceIsHealthy(service);
	return (
		<HStack spacing={12}>
			<RowIcon systemImage="shippingbox.fill" tint={healthy ? undefined : systemColors.orange} />
			<VStack alignment="leading" spacing={3} modifiers={[layoutPriority(1)]}>
				<Text modifiers={[font({ textStyle: 'body' }), lineLimit(1)]}>{service.name}</Text>
				<ImageReferenceLine reference={service.image} />
				{showsStack && service.stackName ? (
					<Label
						title={service.stackName}
						systemImage="square.stack.3d.up"
						modifiers={[
							font({ textStyle: 'caption2' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					/>
				) : null}
			</VStack>
			<Spacer minLength={8} />
			<VStack alignment="trailing" spacing={3}>
				<Text
					modifiers={[
						font({ textStyle: 'subheadline', weight: 'semibold' }),
						monospacedDigit(),
						foregroundStyle(healthy ? systemColors.green : systemColors.orange)
					]}
				>
					{`${service.runningReplicas}/${service.replicas}`}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption2' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{serviceModeTitle(service)}
				</Text>
			</VStack>
		</HStack>
	);
}

function ServiceLink({
	model,
	service
}: {
	model: SwarmServicesModel;
	service: SwarmServiceSummary;
}) {
	const link = (
		<ContextMenu>
			<ContextMenu.Trigger>
				<Button
					onPress={() => model.openDetail(service)}
					modifiers={[buttonStyle('plain'), contentShape(shapes.rectangle())]}
				>
					<HStack>
						<SwarmServiceRow service={service} showsStack={model.showsStack} />
						<DisclosureChevron />
					</HStack>
				</Button>
			</ContextMenu.Trigger>
			<ContextMenu.Items>
				{model.canManage && service.mode === 'replicated' ? (
					<Button onPress={() => model.openScale(service)}>
						<Label title="Scale" systemImage="plusminus" />
					</Button>
				) : null}
				{model.canReadLogs ? (
					<Button onPress={() => model.openLogs(service)}>
						<Label title="Logs" systemImage="text.alignleft" />
					</Button>
				) : null}
				{model.canManage ? (
					<Button
						role="destructive"
						onPress={() => model.requestDelete(service)}
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
					onPress={() => model.requestDelete(service)}
					modifiers={[tint(systemColors.red)]}
				/>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

export function SwarmServicesList({ model }: { model: SwarmServicesModel }) {
	const { snapshot, items } = model;
	return (
		<SwarmListState
			isLoading={snapshot.isLoading}
			isEmpty={items.length === 0}
			errorMessage={snapshot.errorMessage}
			emptyTitle={model.emptyTitle}
			emptySystemImage="shippingbox"
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
							title="Services"
							loadedCount={items.length}
							totalCount={snapshot.totalItems}
							hasMore={snapshot.hasMore}
						/>
					}
				>
					<List.ForEach data={items} keyExtractor={stableItemKey} estimatedItemSize={52}>
						{({ item }) => <ServiceLink model={model} service={item.value} />}
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
	);
}

export function EmbeddedSwarmServices({
	environmentID,
	stackName
}: {
	environmentID: EnvironmentID;
	stackName: string;
}) {
	const model = useSwarmServices(environmentID, stackName);
	return (
		<Host style={{ flex: 1 }}>
			<SwarmServicesList model={model} />
		</Host>
	);
}

export function SwarmServicesScreen() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const model = useSwarmServices(envID);
	const accent = useAccentColor();
	const icon = useToolbarIcons(['plus']);
	return (
		<>
			<Stack.Screen
				options={{
					title: 'Services',
					headerSearchBarOptions: {
						placeholder: 'Search services',
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
						accessibilityLabel="Create Service"
						onPress={model.openCreate}
					/>
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>
				<SwarmServicesList model={model} />
			</Host>
		</>
	);
}

export function ReplicaStepper({
	value,
	onValueChange
}: {
	value: number;
	onValueChange: (value: number) => void;
}) {
	return (
		<HStack>
			<Text>Replicas</Text>
			<Spacer />
			<Text
				modifiers={[
					font({ textStyle: 'body' }),
					monospacedDigit(),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' })
				]}
			>
				{String(value)}
			</Text>
			<Stepper
				label="Replicas"
				value={value}
				min={0}
				max={1000}
				step={1}
				onValueChange={onValueChange}
				modifiers={[labelsHidden(), fixedSize()]}
			/>
		</HStack>
	);
}

export function SwarmScaleScreen() {
	const model = useSwarmScale();
	const service = model.service;
	return (
		<>
			<Stack.Screen options={{ gestureEnabled: !model.isSaving }} />
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[
								navigationTitle(`Scale ${service?.name ?? ''}`),
								navigationBarTitleDisplayMode('inline')
							]}
						>
							<Section
								footer={
									<Text>
										{service
											? `${service.runningReplicas} of ${service.replicas} running now.`
											: ''}
									</Text>
								}
							>
								<ReplicaStepper value={model.replicas} onValueChange={model.setReplicas} />
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
									label="Scale"
									onPress={model.scale}
									modifiers={[disabled(!model.canScale)]}
								/>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
		</>
	);
}
