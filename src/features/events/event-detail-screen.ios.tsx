import { Host } from '@/ui/host';
import { HStack, LabeledContent, List, Section, Text, VStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	background,
	font,
	foregroundStyle,
	frame,
	listStyle,
	padding,
	shapes,
	textSelection
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';

import { withOpacity } from '@/theme/colors';

import { useEventDetail } from './use-event-detail';
import { capitalized, severityIcon, severityTint } from './use-events';

function Value({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
	return (
		<LabeledContent
			label={label}
			modifiers={mono ? [font({ textStyle: 'caption', design: 'monospaced' })] : undefined}
		>
			<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
				{value}
			</Text>
		</LabeledContent>
	);
}

export function EventDetailScreen() {
	const model = useEventDetail();
	if (!model) return <Stack.Screen options={{ title: 'Event', headerLargeTitleEnabled: false }} />;
	const { event } = model;
	const tint = severityTint(event.severity);
	return (
		<>
			<Stack.Screen options={{ title: 'Event', headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<List modifiers={[listStyle('insetGrouped')]}>
					<Section>
						<HStack spacing={14} modifiers={[padding({ vertical: 4 })]}>
							<Image
								systemName={severityIcon(event.severity) as SFSymbol}
								modifiers={[
									font({ textStyle: 'title2', weight: 'semibold' }),
									foregroundStyle(tint),
									frame({ width: 44, height: 44 }),
									background(withOpacity(tint, 0.15), shapes.circle())
								]}
							/>
							<VStack alignment="leading" spacing={3}>
								<Text modifiers={[font({ textStyle: 'headline' })]}>{event.title}</Text>
								<Text
									modifiers={[
										font({ textStyle: 'caption', weight: 'semibold' }),
										foregroundStyle(tint)
									]}
								>
									{capitalized(event.severity)}
								</Text>
							</VStack>
						</HStack>
						{event.description ? (
							<Text modifiers={[font({ textStyle: 'subheadline' }), textSelection(true)]}>
								{event.description}
							</Text>
						) : null}
					</Section>
					<Section title="Event">
						<Value label="Type" value={event.type} />
						<Value label="Occurred" value={model.occurred} />
						{model.recorded ? <Value label="Recorded" value={model.recorded} /> : null}
					</Section>
					{model.hasResource ? (
						<Section title="Resource">
							{event.resourceType ? (
								<Value label="Type" value={capitalized(event.resourceType)} />
							) : null}
							{event.resourceName ? <Value label="Name" value={event.resourceName} /> : null}
							{event.resourceId ? <Value label="ID" value={event.resourceId} mono /> : null}
						</Section>
					) : null}
					{model.hasContext ? (
						<Section title="Context">
							{event.username ? <Value label="User" value={event.username} /> : null}
							{event.userId ? <Value label="User ID" value={event.userId} mono /> : null}
							{event.environmentId ? (
								<Value label="Environment" value={event.environmentId} mono />
							) : null}
						</Section>
					) : null}
					{model.metadata.length > 0 ? (
						<Section title="Metadata">
							{model.metadata.map((pair) => (
								<Value key={pair.key} label={pair.key} value={pair.value} />
							))}
						</Section>
					) : null}
				</List>
			</Host>
		</>
	);
}
