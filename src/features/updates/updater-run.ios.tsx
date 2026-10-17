import {
	Button,
	ContentUnavailableView,
	Divider,
	Group,
	HStack,
	Label,
	LazyVStack,
	List,
	NavigationStack,
	ScrollView,
	Section,
	Spacer,
	Text,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	background,
	buttonStyle,
	contentShape,
	contentTransition,
	controlSize,
	font,
	foregroundStyle,
	frame,
	interactiveDismissDisabled,
	lineLimit,
	listStyle,
	navigationBarTitleDisplayMode,
	navigationTitle,
	onGeometryChange,
	padding,
	presentationDetents,
	presentationDragIndicator,
	shapes,
	symbolEffect,
	textSelection,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { EnvironmentUpdateScene } from '@/features/environments/environment-update-scene';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { UpdaterResourceResult, UpdaterResult } from '@/sdk/models/updater/Updater';
import { useAccentColor } from '@/theme/accent';
import { systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { ResourceStatusBadge } from '@/ui/components/resource-status-badge';
import { RowIcon } from '@/ui/components/row-icon';
import { glassEffectCompat } from '@/ui/components/swiftui-surfaces';
import { environmentDisplayName } from '@/stores/environments-store';

import {
	capitalized,
	resourceTypeIcon,
	resourceTypeTint,
	resultImageChange,
	updaterStatusText,
	updaterStatusTint
} from './updates-logic';
import { useUpdaterRun } from './use-updater-run';

export function EnvironmentPickerRow({
	environment,
	onPress
}: {
	environment: Environment;
	onPress: () => void;
}) {
	return (
		<Button onPress={onPress} modifiers={[buttonStyle('plain')]}>
			<HStack modifiers={[contentShape(shapes.rectangle())]}>
				<VStack alignment="leading" spacing={2}>
					<Text modifiers={[foregroundStyle('primary')]}>
						{environmentDisplayName(environment)}
					</Text>
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
							lineLimit(1),
							truncationMode('middle')
						]}
					>
						{environment.apiUrl}
					</Text>
				</VStack>
				<Spacer minLength={8} />
				<ResourceStatusBadge status={environment.status} usesCardStyle />
			</HStack>
		</Button>
	);
}

export function UpdaterRunSheet({
	environments,
	initialEnvironmentID,
	onDismiss
}: {
	environments: Environment[];
	initialEnvironmentID?: string;
	onDismiss: () => void;
}) {
	const [selectedEnvironmentID, setSelectedEnvironmentID] = useState(initialEnvironmentID);
	const accent = useAccentColor();
	return (
		<Group
			modifiers={[presentationDetents(['medium', 'large']), presentationDragIndicator('visible')]}
		>
			<NavigationStack>
				{selectedEnvironmentID !== undefined ? (
					<UpdaterRunView
						key={selectedEnvironmentID}
						environmentID={selectedEnvironmentID}
						onDismiss={onDismiss}
					/>
				) : (
					<Toolbar>
						{environments.length === 0 ? (
							<ContentUnavailableView
								title="No Environments"
								systemImage="server.rack"
								description="Add an environment before running the updater."
								modifiers={[
									navigationTitle('Run Updater'),
									navigationBarTitleDisplayMode('inline')
								]}
							/>
						) : (
							<List
								modifiers={[
									listStyle('insetGrouped'),
									navigationTitle('Run Updater'),
									navigationBarTitleDisplayMode('inline')
								]}
							>
								<Section footer={<Text>Pick an environment to run the container updater on.</Text>}>
									{environments.map((environment) => (
										<EnvironmentPickerRow
											key={environment.id}
											environment={environment}
											onPress={() => setSelectedEnvironmentID(environment.id)}
										/>
									))}
								</Section>
							</List>
						)}
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button label="Cancel" onPress={onDismiss} modifiers={[foregroundStyle(accent)]} />
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				)}
			</NavigationStack>
		</Group>
	);
}

function CardHeader({ title, icon, tint }: { title: string; icon: string; tint: string }) {
	return (
		<HStack spacing={8}>
			<Image
				systemName={icon as SFSymbol}
				modifiers={[font({ textStyle: 'callout', weight: 'semibold' }), foregroundStyle(tint)]}
			/>
			<Text modifiers={[font({ textStyle: 'headline' })]}>{title}</Text>
			<Spacer />
		</HStack>
	);
}

const cardModifiers = () => [
	padding({ all: 20 }),
	frame({ maxWidth: Infinity, alignment: 'leading' as const }),
	glassEffectCompat({ shape: 'roundedRectangle', cornerRadius: Radius.card })
];

function CounterTile({
	label,
	value,
	icon,
	tint
}: {
	label: string;
	value: number;
	icon: string;
	tint: string;
}) {
	return (
		<VStack
			alignment="leading"
			spacing={6}
			modifiers={[
				frame({ maxWidth: Infinity, alignment: 'leading' }),
				padding({ all: 16 }),
				background(
					withOpacity(tint, 0.1),
					shapes.roundedRectangle({ cornerRadius: Radius.standard })
				)
			]}
		>
			<HStack spacing={6}>
				<Image
					systemName={icon as SFSymbol}
					modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), foregroundStyle(tint)]}
				/>
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						lineLimit(1)
					]}
				>
					{label}
				</Text>
			</HStack>
			<Text
				modifiers={[
					font({ textStyle: 'title', design: 'rounded', weight: 'bold' }),
					foregroundStyle('primary'),
					contentTransition('numericText')
				]}
			>
				{String(value)}
			</Text>
		</VStack>
	);
}

function CountersCard({ containers, projects }: { containers: number; projects: number }) {
	return (
		<VStack alignment="leading" spacing={14} modifiers={cardModifiers()}>
			<CardHeader title="In Progress" icon="chart.bar.fill" tint={systemColors.purple} />
			<HStack spacing={12}>
				<CounterTile
					label="Containers"
					value={containers}
					icon="shippingbox.fill"
					tint={systemColors.blue}
				/>
				<CounterTile
					label="Projects"
					value={projects}
					icon="folder.fill"
					tint={systemColors.purple}
				/>
			</HStack>
		</VStack>
	);
}

function ResultCountersCard({ result }: { result: UpdaterResult }) {
	return (
		<VStack alignment="leading" spacing={14} modifiers={cardModifiers()}>
			<CardHeader title="Summary" icon="chart.bar.fill" tint={systemColors.purple} />
			<HStack spacing={12}>
				<CounterTile
					label="Checked"
					value={result.checked}
					icon="magnifyingglass"
					tint={systemColors.blue}
				/>
				<CounterTile
					label="Updated"
					value={result.updated}
					icon="checkmark.circle.fill"
					tint={systemColors.green}
				/>
			</HStack>
			<HStack spacing={12}>
				<CounterTile
					label="Skipped"
					value={result.skipped}
					icon="minus.circle.fill"
					tint={systemColors.gray}
				/>
				<CounterTile
					label="Failed"
					value={result.failed}
					icon="xmark.circle.fill"
					tint={systemColors.red}
				/>
			</HStack>
		</VStack>
	);
}

function IdListCard({
	title,
	icon,
	tint,
	ids
}: {
	title: string;
	icon: string;
	tint: string;
	ids: string[];
}) {
	return (
		<VStack alignment="leading" spacing={14} modifiers={cardModifiers()}>
			<CardHeader title={title} icon={icon} tint={tint} />
			<VStack spacing={0}>
				{ids.map((id, index) => (
					<VStack key={`${index}`} spacing={0}>
						<HStack spacing={12} modifiers={[padding({ vertical: 10 })]}>
							<Image
								systemName="arrow.triangle.2.circlepath"
								modifiers={[
									font({ textStyle: 'caption', weight: 'semibold' }),
									foregroundStyle(tint),
									symbolEffect({ effect: 'rotate' }, { options: { repeat: 'continuous' } }),
									frame({ width: 22, height: 22 }),
									background(withOpacity(tint, 0.15), shapes.circle())
								]}
							/>
							<Text
								modifiers={[
									font({ textStyle: 'caption', design: 'monospaced' }),
									lineLimit(1),
									truncationMode('middle'),
									textSelection(true)
								]}
							>
								{id}
							</Text>
							<Spacer minLength={0} />
						</HStack>
						{index < ids.length - 1 ? <Divider /> : null}
					</VStack>
				))}
			</VStack>
		</VStack>
	);
}

function UpdaterRunItemRow({ item }: { item: UpdaterResourceResult }) {
	const change = resultImageChange(item);
	const statusTint = updaterStatusTint(item, true);
	return (
		<HStack spacing={12}>
			<RowIcon
				systemImage={resourceTypeIcon(item.resourceType)}
				tint={resourceTypeTint(item.resourceType)}
			/>
			<VStack alignment="leading" spacing={3}>
				<Text
					modifiers={[
						font({ textStyle: 'subheadline', weight: 'semibold' }),
						lineLimit(1),
						truncationMode('middle')
					]}
				>
					{item.resourceName ?? item.resourceId}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{capitalized(item.resourceType)}
				</Text>
				{change !== undefined ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption2', design: 'monospaced' }),
							foregroundStyle({ type: 'hierarchical', style: 'tertiary' }),
							lineLimit(1),
							truncationMode('middle')
						]}
					>
						{change}
					</Text>
				) : null}
				{item.error !== undefined && item.error !== '' ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption2' }),
							foregroundStyle(systemColors.red),
							lineLimit(2)
						]}
					>
						{item.error}
					</Text>
				) : null}
			</VStack>
			<Spacer minLength={8} />
			<Text
				modifiers={[
					font({ textStyle: 'caption2', weight: 'bold' }),
					foregroundStyle(statusTint),
					padding({ horizontal: 8, vertical: 3 }),
					background(withOpacity(statusTint, 0.15), shapes.capsule())
				]}
			>
				{updaterStatusText(item)}
			</Text>
		</HStack>
	);
}

function ResultItemsCard({ items }: { items: UpdaterResourceResult[] }) {
	return (
		<VStack alignment="leading" spacing={14} modifiers={cardModifiers()}>
			<CardHeader
				title={`Resources (${items.length})`}
				icon="list.bullet.rectangle.portrait"
				tint={systemColors.indigo}
			/>
			<VStack spacing={0}>
				{items.map((item, index) => (
					<VStack key={`${index}`} spacing={0}>
						<VStack modifiers={[padding({ vertical: 10 })]}>
							<UpdaterRunItemRow item={item} />
						</VStack>
						{index < items.length - 1 ? <Divider /> : null}
					</VStack>
				))}
			</VStack>
		</VStack>
	);
}

export function UpdaterRunView({
	environmentID,
	onDismiss
}: {
	environmentID: string;
	onDismiss: () => void;
}) {
	const model = useUpdaterRun(environmentID);
	const accent = useAccentColor();
	const [height, setHeight] = useState(0);
	const { phase, liveStatus } = model;

	let details = null;
	switch (phase.kind) {
		case 'starting':
			break;
		case 'running':
			details = liveStatus ? (
				<>
					<CountersCard
						containers={liveStatus.updatingContainers}
						projects={liveStatus.updatingProjects}
					/>
					{liveStatus.containerIds.length > 0 ? (
						<IdListCard
							title="Containers Updating"
							icon="shippingbox.fill"
							tint={systemColors.blue}
							ids={liveStatus.containerIds}
						/>
					) : null}
					{liveStatus.projectIds.length > 0 ? (
						<IdListCard
							title="Projects Updating"
							icon="folder.fill"
							tint={systemColors.purple}
							ids={liveStatus.projectIds}
						/>
					) : null}
				</>
			) : null;
			break;
		case 'completed':
			details = (
				<>
					<ResultCountersCard result={phase.result} />
					{phase.result.items.length > 0 ? <ResultItemsCard items={phase.result.items} /> : null}
				</>
			);
			break;
		case 'failed':
			details = (
				<Button onPress={model.retry} modifiers={[buttonStyle('bordered'), controlSize('large')]}>
					<Label
						title="Try Again"
						systemImage="arrow.clockwise"
						modifiers={[frame({ maxWidth: Infinity }), padding({ vertical: 6 })]}
					/>
				</Button>
			);
			break;
	}

	return (
		<Toolbar>
			<ScrollView
				modifiers={[
					onGeometryChange((frame) => setHeight(frame.height)),
					navigationTitle('Run Updater'),
					navigationBarTitleDisplayMode('inline'),
					interactiveDismissDisabled(phase.kind === 'starting')
				]}
			>
				<LazyVStack
					spacing={24}
					modifiers={[
						frame({ maxWidth: 680 }),
						padding({ horizontal: 16, vertical: 20 }),
						frame({ maxWidth: Infinity }),
						frame({ minHeight: height, alignment: 'center' })
					]}
				>
					<EnvironmentUpdateScene model={model.scene} />
					{details}
				</LazyVStack>
			</ScrollView>
			<Toolbar.Content>
				<ToolbarItem placement="cancellationAction">
					<Button
						label={model.doneTitle}
						onPress={onDismiss}
						modifiers={[foregroundStyle(accent)]}
					/>
				</ToolbarItem>
			</Toolbar.Content>
		</Toolbar>
	);
}
