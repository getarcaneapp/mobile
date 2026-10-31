import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { DashboardWidget, type DashboardWidgetID } from '@/features/dashboard/dashboard-widgets';
import { useDashboardLayout } from '@/features/dashboard/use-dashboard-layout';
import { colors, systemColors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section, TextButtonRow } from '../shared/android-material';

function WidgetRow({ id, children }: { id: DashboardWidgetID; children?: ReactNode }) {
	const info = DashboardWidget.info[id];
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 12,
				minHeight: 56,
				paddingLeft: 16,
				paddingRight: 8
			}}
		>
			<RowIcon systemImage={info.systemImage} tint={systemColors[info.tint]} size={30} />
			<Text style={[m3Type.bodyLarge, { flex: 1, color: colors.label }]}>{info.title}</Text>
			{children}
		</View>
	);
}

function IconAction({
	icon,
	label,
	color,
	disabled,
	onPress
}: {
	icon: string;
	label: string;
	color: string;
	disabled?: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={label}
			android_ripple={{ color: colors.separator as string, borderless: true, radius: 20 }}
			style={{
				width: 40,
				height: 40,
				alignItems: 'center',
				justifyContent: 'center',
				opacity: disabled ? 0.3 : 1
			}}
		>
			<Icon name={icon} size={22} color={color} />
		</Pressable>
	);
}

export function DashboardWidgetsEditorScreen() {
	const layout = useDashboardLayout();
	const last = layout.visible.length - 1;
	return (
		<>
			<Stack.Screen options={{ title: 'Dashboard' }} />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 24 }}
			>
				<M3Section title="Shown">
					{layout.visible.map((entry, index) => {
						const title = DashboardWidget.info[entry.id].title;
						return (
							<WidgetRow key={`shown.${entry.id}`} id={entry.id}>
								<IconAction
									icon="chevron.up"
									label={`Move ${title} up`}
									color={colors.secondaryLabel as string}
									disabled={index === 0}
									onPress={() => layout.moveBy(entry.id, -1)}
								/>
								<IconAction
									icon="chevron.down"
									label={`Move ${title} down`}
									color={colors.secondaryLabel as string}
									disabled={index === last}
									onPress={() => layout.moveBy(entry.id, 1)}
								/>
								<IconAction
									icon="minus.circle.fill"
									label={`Hide ${title}`}
									color={m3.error as string}
									onPress={() => layout.hide([entry.id])}
								/>
							</WidgetRow>
						);
					})}
				</M3Section>
				{layout.hidden.length > 0 ? (
					<M3Section title="Hidden">
						{layout.hidden.map((entry) => (
							<WidgetRow key={`hidden.${entry.id}`} id={entry.id}>
								<IconAction
									icon="plus.circle.fill"
									label={`Show ${DashboardWidget.info[entry.id].title}`}
									color={systemColors.green}
									onPress={() => layout.show(entry.id)}
								/>
							</WidgetRow>
						))}
					</M3Section>
				) : null}
				{layout.isCustomized ? (
					<M3Section>
						<TextButtonRow title="Reset to Defaults" onPress={layout.reset} />
					</M3Section>
				) : null}
			</ScrollView>
		</>
	);
}
