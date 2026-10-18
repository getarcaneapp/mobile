import { Host } from '@/ui/host';
import {
	Button,
	ContentUnavailableView,
	HStack,
	List,
	Section,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	background,
	buttonStyle,
	font,
	foregroundStyle,
	frame,
	listStyle,
	padding,
	refreshable,
	shapes,
	contentShape
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';

import type { PortMapping } from '@/sdk/models/port/PortMapping';
import { useAccentColor } from '@/theme/accent';
import { systemColors, withOpacity } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import {
	EnvironmentLabel,
	EnvironmentLoadFailuresSection
} from '@/ui/components/environment-label';
import { ResourceCountLabel } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { stableItemKey } from '@/ui/components/stable-sectioned-list.types';
import { DisclosureChevron } from '@/ui/settings-row';
import { useToolbarIcons } from '@/ui/toolbar-icon';

import { useEnvironmentRowColor } from '@/features/containers/hooks';

import {
	hostString,
	protocolTint,
	usePortsList,
	type PortItem,
	type PortsListProps
} from './use-ports-list';

const mono = (weight?: 'semibold') =>
	font({ textStyle: 'subheadline', weight, design: 'monospaced' });

function PortMappingRow({
	port,
	environmentName,
	environmentColor
}: {
	port: PortMapping;
	environmentName?: string;
	environmentColor?: string;
}) {
	return (
		<HStack spacing={12} modifiers={[padding({ vertical: 2 })]}>
			<RowIcon
				systemImage={port.isPublished ? 'arrow.left.arrow.right' : 'lock.fill'}
				tint={port.isPublished ? systemColors.green : systemColors.gray}
			/>
			<VStack alignment="leading" spacing={3}>
				<HStack spacing={6}>
					{port.hostPort !== undefined ? (
						<>
							<Text modifiers={[mono('semibold')]}>{hostString(port)}</Text>
							<Image
								systemName="arrow.right"
								modifiers={[
									font({ textStyle: 'caption2' }),
									foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
								]}
							/>
							<Text
								modifiers={[
									mono('semibold'),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' })
								]}
							>
								{String(port.containerPort)}
							</Text>
						</>
					) : (
						<>
							<Text modifiers={[mono('semibold')]}>{String(port.containerPort)}</Text>
							<Text
								modifiers={[
									font({ textStyle: 'caption2' }),
									foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
								]}
							>
								(internal)
							</Text>
						</>
					)}
				</HStack>
				<Text
					modifiers={[
						font({ textStyle: 'caption2', weight: 'bold' }),
						foregroundStyle(protocolTint(port))
					]}
				>
					{port.protocolName.toUpperCase()}
				</Text>
				<EnvironmentLabel name={environmentName} color={environmentColor} />
			</VStack>
			<Spacer minLength={8} />
			{port.isPublished ? (
				<Text
					modifiers={[
						font({ textStyle: 'caption2', weight: 'bold' }),
						foregroundStyle(systemColors.green),
						padding({ horizontal: 6, vertical: 2 }),
						background(withOpacity(systemColors.green, 0.15), shapes.capsule())
					]}
				>
					PUB
				</Text>
			) : null}
		</HStack>
	);
}

function PortLink({ port, onPress }: { port: PortItem; onPress: () => void }) {
	const environmentColor = useEnvironmentRowColor(port.environmentID, port.environmentName);
	return (
		<Button onPress={onPress} modifiers={[buttonStyle('plain'), contentShape(shapes.rectangle())]}>
			<HStack>
				<PortMappingRow
					port={port.value}
					environmentName={port.environmentName}
					environmentColor={environmentColor}
				/>
				<DisclosureChevron />
			</HStack>
		</Button>
	);
}

export function PortsScreen(props: PortsListProps) {
	const model = usePortsList(props);
	const { snapshot, ports, sections } = model;
	const accent = useAccentColor();
	const icon = useToolbarIcons(['arrow.clockwise']);

	let content;
	if (snapshot.isLoading && ports.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading ports…" />
			</VStack>
		);
	} else if (snapshot.errorMessage !== undefined && ports.length === 0) {
		content = (
			<ContentUnavailableView
				title="Couldn't Load Ports"
				systemImage="exclamationmark.triangle"
				description={snapshot.errorMessage}
			/>
		);
	} else if (ports.length === 0) {
		content = (
			<ContentUnavailableView
				title="No Ports"
				systemImage="point.3.connected.trianglepath.dotted"
			/>
		);
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(model.refresh)]}>
				<EnvironmentLoadFailuresSection
					failures={snapshot.failedEnvironments.map((failure) => ({
						...failure,
						id: failure.environment.id
					}))}
					retry={() => void model.load()}
				/>
				{sections.map((group, index) => (
					<Section
						key={group.id}
						header={
							<HStack spacing={8}>
								<Image
									systemName="shippingbox.fill"
									modifiers={[
										font({ textStyle: 'caption', weight: 'semibold' }),
										foregroundStyle(systemColors.blue)
									]}
								/>
								<Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' })]}>
									{group.container}
								</Text>
								<Text
									modifiers={[
										font({ textStyle: 'caption2' }),
										foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
									]}
								>{`(${group.ports.length})`}</Text>
								<Spacer minLength={8} />
								{index === 0 ? (
									<ResourceCountLabel
										loadedCount={ports.length}
										totalCount={snapshot.totalItems}
										hasMore={snapshot.hasMore}
									/>
								) : null}
							</HStack>
						}
					>
						<List.ForEach data={group.ports} keyExtractor={stableItemKey} estimatedItemSize={44}>
							{({ item }) => <PortLink port={item} onPress={() => model.openDetail(item)} />}
						</List.ForEach>
					</Section>
				))}
				<PaginatedListFooter
					hasMore={snapshot.hasMore}
					loadMoreError={snapshot.loadMoreError}
					onRetry={() => void model.loadMore()}
					onLoadMore={() => void model.loadMore()}
				/>
			</List>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Ports',
					headerSearchBarOptions: {
						placeholder: 'Search ports',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			<AppToolbar placement="right" tintColor={accent}>
				<Stack.Toolbar.Button
					icon={icon('arrow.clockwise')}
					accessibilityLabel="Refresh"
					disabled={snapshot.isLoading}
					onPress={() => void model.load()}
				/>
			</AppToolbar>
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}
