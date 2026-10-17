/** Port of `ContainerProcessesView` (ContainerProcessesView.swift). */
import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import { ContentUnavailableView, HStack, List, Section, Text, VStack } from '@expo/ui/swift-ui';
import {
	background,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	listStyle,
	monospacedDigit,
	padding,
	refreshable,
	shapes,
	textSelection
} from '@expo/ui/swift-ui/modifiers';

import type { EnvironmentID } from '@/sdk/client/environment';
import { systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { MonospacedValue } from '@/ui/components/resource-detail';

import { useContainerProcesses } from './use-container-processes';

export function ContainerProcessesView({
	environmentID,
	containerID
}: {
	environmentID: EnvironmentID;
	containerID: string;
}) {
	const { list, rows, isLoading, errorMessage, notRunning, load } = useContainerProcesses(
		environmentID,
		containerID
	);

	let content;
	if (isLoading && !list) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading…" />
			</VStack>
		);
	} else if (notRunning) {
		content = (
			<ContentUnavailableView
				title="Container Not Running"
				systemImage="stop.circle"
				description="Start the container to see its processes."
			/>
		);
	} else if (errorMessage !== undefined && !list) {
		content = (
			<UnavailableView
				title="Couldn't Load Processes"
				systemImage="exclamationmark.triangle"
				description={errorMessage}
				actions={[{ title: 'Try Again', onPress: () => void load() }]}
			/>
		);
	} else if (rows.length === 0) {
		content = (
			<ContentUnavailableView
				title="No Processes"
				systemImage="list.number"
				description="The container didn't report any processes."
			/>
		);
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(load)]}>
				<Section header={<Text>{`${rows.length} process${rows.length === 1 ? '' : 'es'}`}</Text>}>
					{rows.map((row) => (
						<VStack
							key={row.id}
							alignment="leading"
							spacing={6}
							modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), textSelection(true)]}
						>
							<HStack alignment="firstTextBaseline" spacing={8}>
								{row.pid !== undefined ? (
									<Text
										modifiers={[
											font({ textStyle: 'caption', weight: 'semibold' }),
											monospacedDigit(),
											padding({ horizontal: 6, vertical: 2 }),
											background(
												withOpacity(systemColors.orange, 0.15),
												shapes.roundedRectangle({ cornerRadius: Radius.small })
											),
											foregroundStyle(systemColors.orange)
										]}
									>
										{row.pid}
									</Text>
								) : null}
								{row.user !== undefined ? (
									<Text
										modifiers={[
											font({ textStyle: 'caption' }),
											foregroundStyle({ type: 'hierarchical', style: 'secondary' })
										]}
									>
										{row.user}
									</Text>
								) : null}
							</HStack>
							{row.command !== undefined ? (
								<MonospacedValue value={row.command} lineLimit={3} />
							) : null}
							{row.extras.length > 0 ? (
								<Text
									modifiers={[
										font({ textStyle: 'caption2', design: 'monospaced' }),
										foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
										lineLimit(2)
									]}
								>
									{row.extras.map((extra) => `${extra.title} ${extra.value}`).join(' · ')}
								</Text>
							) : null}
						</VStack>
					))}
				</Section>
			</List>
		);
	}
	return <Host style={{ flex: 1 }}>{content}</Host>;
}
