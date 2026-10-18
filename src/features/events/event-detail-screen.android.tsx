import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { colors, withOpacity } from '@/theme/colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section, ValueRow } from '@/features/containers/android-material';

import { useEventDetail } from './use-event-detail';
import { capitalized, severityIcon, severityTint } from './use-events';

export function EventDetailScreen() {
	const model = useEventDetail();
	if (!model) return <Stack.Screen options={{ title: 'Event' }} />;
	const { event } = model;
	const tint = severityTint(event.severity);
	return (
		<>
			<Stack.Screen options={{ title: 'Event' }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				<M3Section>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
						<View
							style={{
								width: 44,
								height: 44,
								borderRadius: 22,
								alignItems: 'center',
								justifyContent: 'center',
								backgroundColor: withOpacity(tint, 0.15)
							}}
						>
							<Icon name={severityIcon(event.severity)} size={22} color={tint} />
						</View>
						<View style={{ flex: 1, gap: 3 }}>
							<Text style={[m3Type.titleMedium, { color: colors.label }]}>{event.title}</Text>
							<Text style={[m3Type.labelMedium, { color: tint }]}>
								{capitalized(event.severity)}
							</Text>
						</View>
					</View>
					{event.description ? (
						<Text
							selectable
							style={[
								m3Type.bodyMedium,
								{ color: colors.label, paddingHorizontal: 16, paddingBottom: 16 }
							]}
						>
							{event.description}
						</Text>
					) : null}
				</M3Section>
				<M3Section title="Event">
					<ValueRow title="Type" value={model.typeTitle} />
					<ValueRow title="Occurred" value={model.occurred} />
					{model.recorded ? <ValueRow title="Recorded" value={model.recorded} /> : null}
				</M3Section>
				{model.hasResource ? (
					<M3Section title="Resource">
						{event.resourceType ? (
							<ValueRow title="Type" value={capitalized(event.resourceType)} />
						) : null}
						{event.resourceName ? <ValueRow title="Name" value={event.resourceName} /> : null}
						{event.resourceId ? <ValueRow title="ID" value={event.resourceId} monospaced /> : null}
					</M3Section>
				) : null}
				{model.hasContext ? (
					<M3Section title="Context">
						{event.username ? <ValueRow title="User" value={event.username} /> : null}
						{event.userId ? <ValueRow title="User ID" value={event.userId} monospaced /> : null}
						{model.environmentName !== undefined ? (
							<ValueRow title="Environment" value={model.environmentName} />
						) : null}
					</M3Section>
				) : null}
				{model.metadata.length > 0 ? (
					<M3Section title="Metadata">
						{model.metadata.map((pair) => (
							<ValueRow key={pair.key} title={pair.key} value={pair.value} />
						))}
					</M3Section>
				) : null}
			</ScrollView>
		</>
	);
}
