/**
 * Android rendering of `DashboardTilesEditor` (DashboardTotalsTile.swift).
 * Arrow buttons stand in for drag-to-reorder; the remove button for swipe-to-delete.
 */
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { DashboardTotalsTile } from '@/features/dashboard/dashboard-logic';
import { colors, systemColors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section, TextButtonRow } from '../shared/android-material';
import { useDashboardTilesEditor } from './use-dashboard-tiles-editor';

function TileRow({ tile, children }: { tile: DashboardTotalsTile; children?: ReactNode }) {
	const info = DashboardTotalsTile.info[tile];
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 12,
				minHeight: 64,
				paddingLeft: 16,
				paddingRight: 8
			}}
		>
			<RowIcon systemImage={info.systemImage} tint={systemColors[info.tint]} size={30} />
			<View style={{ flex: 1, gap: 2 }}>
				<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{info.title}</Text>
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>{info.detail}</Text>
			</View>
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

export function DashboardTilesEditorScreen() {
	const model = useDashboardTilesEditor();
	const last = model.tiles.length - 1;
	return (
		<>
			<Stack.Screen options={{ title: 'Dashboard Tiles' }} />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 24 }}
			>
				<M3Section title="Shown" footer={`Up to ${DashboardTotalsTile.maximum} tiles.`}>
					{model.tiles.map((tile, index) => {
						const title = DashboardTotalsTile.info[tile].title;
						return (
							<TileRow key={`shown.${tile}`} tile={tile}>
								<IconAction
									icon="chevron.up"
									label={`Move ${title} up`}
									color={colors.secondaryLabel as string}
									disabled={index === 0}
									onPress={() => model.move([index], index - 1)}
								/>
								<IconAction
									icon="chevron.down"
									label={`Move ${title} down`}
									color={colors.secondaryLabel as string}
									disabled={index === last}
									onPress={() => model.move([index], index + 2)}
								/>
								<IconAction
									icon="minus.circle.fill"
									label={`Remove ${title}`}
									color={m3.error as string}
									disabled={model.tiles.length === 1}
									onPress={() => model.remove([index])}
								/>
							</TileRow>
						);
					})}
				</M3Section>
				{model.available.length > 0 ? (
					<M3Section title="Available">
						{model.available.map((tile) => (
							<TileRow key={`available.${tile}`} tile={tile}>
								<IconAction
									icon="plus.circle.fill"
									label={`Add ${DashboardTotalsTile.info[tile].title}`}
									color={systemColors.green}
									disabled={model.isFull}
									onPress={() => model.add(tile)}
								/>
							</TileRow>
						))}
					</M3Section>
				) : null}
				<M3Section>
					<TextButtonRow title="Reset to Defaults" onPress={model.reset} />
				</M3Section>
			</ScrollView>
		</>
	);
}
