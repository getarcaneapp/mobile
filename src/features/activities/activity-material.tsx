/**
 * Material 3 pieces shared by the Android Activity screens:
 * `ActivityProgressView` (ActivityProgressView.swift), `ActivityIcon`, empty
 * states, and a top-app-bar action row with (sub)menus.
 */
import { MenuView, type MenuAction } from '@react-native-menu/menu';
import { Stack } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View, type ColorValue } from 'react-native';

import type { Activity } from '@/sdk/models/activity/Activity';
import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { ActivityDisplay, type ActivityTint } from './activity-display';

export function materialTint(tint: ActivityTint): ColorValue {
	return tint === 'secondary' ? colors.secondaryLabel : tint;
}

export function ActivityProgressView({
	progress,
	isActive,
	tint,
	showsPercentage = false
}: {
	progress: number | undefined;
	isActive: boolean;
	tint: ActivityTint;
	showsPercentage?: boolean;
}) {
	const color = materialTint(tint);
	if (progress !== undefined) {
		const bar = (
			<View
				accessibilityRole="progressbar"
				accessibilityValue={{ min: 0, max: 100, now: progress }}
				style={{
					height: 4,
					borderRadius: 2,
					backgroundColor: m3.surfaceContainerHighest,
					overflow: 'hidden'
				}}
			>
				<View
					style={{ width: `${progress}%`, height: '100%', borderRadius: 2, backgroundColor: color }}
				/>
			</View>
		);
		if (!showsPercentage) return bar;
		return (
			<View style={{ gap: 6 }}>
				<Text style={[m3Type.bodyLarge, { color: colors.label }]}>Progress</Text>
				{bar}
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>{`${progress}%`}</Text>
			</View>
		);
	}
	if (isActive) {
		return (
			<View accessible style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
				<ActivityIndicator size="small" color={color} />
				<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>In progress</Text>
			</View>
		);
	}
	return null;
}

export function ActivitySymbol({ systemName, tint }: { systemName: string; tint: ActivityTint }) {
	return (
		<View
			importantForAccessibility="no-hide-descendants"
			style={{ width: 28, alignItems: 'center', paddingTop: 2 }}
		>
			<Icon name={systemName} size={20} color={materialTint(tint)} />
		</View>
	);
}

export function ActivityIcon({ activity }: { activity: Activity }) {
	return (
		<ActivitySymbol
			systemName={ActivityDisplay.typeIcon(activity)}
			tint={ActivityDisplay.statusTint(activity)}
		/>
	);
}

/** `ContentUnavailableView` (+ optional action). */
export function EmptyState({
	icon,
	title,
	message,
	action
}: {
	icon: string;
	title: string;
	message: string;
	action?: { title: string; onPress: () => void };
}) {
	return (
		<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 }}>
			<Icon name={icon} size={44} color={colors.secondaryLabel} />
			<Text style={[m3Type.titleLarge, { color: colors.label, textAlign: 'center' }]}>{title}</Text>
			<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}>
				{message}
			</Text>
			{action ? (
				<Pressable
					onPress={action.onPress}
					accessibilityRole="button"
					style={{ marginTop: 8, paddingHorizontal: 16, paddingVertical: 10 }}
				>
					<Text style={[m3Type.labelLarge, { color: m3.primary }]}>{action.title}</Text>
				</Pressable>
			) : null}
		</View>
	);
}

export type ToolbarMenuEntry = {
	id: string;
	title: string;
	checked?: boolean;
	destructive?: boolean;
	onPress?: () => void;
	/** A nested popup (SwiftUI `Picker` inside a `Menu`). */
	children?: ToolbarMenuEntry[];
};

export type ActivityToolbarItem =
	| {
			kind: 'button';
			id: string;
			icon: string;
			label: string;
			onPress: () => void;
			disabled?: boolean;
			color?: ColorValue;
	  }
	| { kind: 'menu'; id: string; icon: string; label: string; entries: ToolbarMenuEntry[] }
	| { kind: 'spinner'; id: string; label: string };

function toMenuAction(entry: ToolbarMenuEntry): MenuAction {
	return {
		id: entry.id,
		title: entry.title,
		state: entry.checked === undefined ? undefined : entry.checked ? 'on' : 'off',
		attributes: { destructive: entry.destructive },
		subactions: entry.children?.map(toMenuAction)
	};
}

function findEntry(entries: ToolbarMenuEntry[], id: string): ToolbarMenuEntry | undefined {
	for (const entry of entries) {
		if (entry.id === id) return entry;
		const nested = entry.children ? findEntry(entry.children, id) : undefined;
		if (nested) return nested;
	}
	return undefined;
}

function Glyph({
	icon,
	color,
	disabled
}: {
	icon: string;
	color?: ColorValue;
	disabled?: boolean;
}) {
	return (
		<View
			style={{
				width: 48,
				height: 48,
				alignItems: 'center',
				justifyContent: 'center',
				opacity: disabled ? 0.38 : 1
			}}
		>
			<Icon name={icon} size={24} color={color ?? m3.onSurfaceVariant} />
		</View>
	);
}

/** Material top-app-bar actions (icon buttons and popup menus). */
export function ActivityToolbar({ items }: { items: ActivityToolbarItem[] }) {
	if (items.length === 0) return null;
	return (
		<Stack.Toolbar placement="right">
			<Stack.Toolbar.View>
				<View style={{ flexDirection: 'row', alignItems: 'center' }}>
					{items.map((item) => {
						if (item.kind === 'spinner') {
							return (
								<View
									key={item.id}
									style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
								>
									<ActivityIndicator accessibilityLabel={item.label} />
								</View>
							);
						}
						if (item.kind === 'button') {
							return (
								<Pressable
									key={item.id}
									onPress={item.onPress}
									disabled={item.disabled}
									accessibilityRole="button"
									accessibilityLabel={item.label}
									accessibilityState={{ disabled: item.disabled }}
									android_ripple={{
										color: colors.separator as string,
										borderless: true,
										radius: 20
									}}
								>
									<Glyph icon={item.icon} color={item.color} disabled={item.disabled} />
								</Pressable>
							);
						}
						return (
							<MenuView
								key={item.id}
								actions={item.entries.map(toMenuAction)}
								onPressAction={({ nativeEvent }) =>
									findEntry(item.entries, nativeEvent.event)?.onPress?.()
								}
							>
								<View accessible accessibilityRole="button" accessibilityLabel={item.label}>
									<Glyph icon={item.icon} />
								</View>
							</MenuView>
						);
					})}
				</View>
			</Stack.Toolbar.View>
		</Stack.Toolbar>
	);
}
