/** Android rendering of `DynamicResourceDetailView` + `DynamicValueRow` (DynamicResourceViews.swift). */
import { Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AndroidToolbar, type AndroidMenuItem } from '@/features/settings/shared/android-toolbar';
import { M3Section, ValueRow } from '@/features/settings/shared/android-material';
import { colors, systemColors } from '@/theme/colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import {
	isJSONObject,
	jsonDisplayString,
	prettyKey,
	standardCompare,
	type JSONValue
} from './dynamic-resource';
import { useDynamicResourceDetail } from './use-dynamic-resource-detail';

function Disclosure({
	title,
	depth,
	children
}: {
	title: string;
	depth: number;
	children: ReactNode;
}) {
	const [expanded, setExpanded] = useState(false);
	return (
		<View>
			<Pressable
				onPress={() => setExpanded((value) => !value)}
				accessibilityRole="button"
				accessibilityState={{ expanded }}
				android_ripple={{ color: colors.separator as string }}
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					minHeight: 48,
					paddingLeft: 16 + depth * 16,
					paddingRight: 16,
					gap: 8
				}}
			>
				<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{title}</Text>
				<Icon
					name={expanded ? 'chevron.up' : 'chevron.down'}
					size={18}
					color={colors.secondaryLabel}
				/>
			</Pressable>
			{expanded ? children : null}
		</View>
	);
}

/** Port of `DynamicValueRow`. Standalone. */
export function DynamicValueRow({
	name,
	value,
	depth = 0
}: {
	name: string;
	value: JSONValue;
	depth?: number;
}) {
	if (isJSONObject(value)) {
		return (
			<Disclosure title={prettyKey(name)} depth={depth}>
				{Object.entries(value)
					.sort(([lhs], [rhs]) => standardCompare(lhs, rhs))
					.map(([childKey, childValue]) => (
						<DynamicValueRow key={childKey} name={childKey} value={childValue} depth={depth + 1} />
					))}
			</Disclosure>
		);
	}
	if (Array.isArray(value)) {
		return (
			<Disclosure title={`${prettyKey(name)} (${value.length})`} depth={depth}>
				{value.map((childValue, index) => (
					<DynamicValueRow
						key={index}
						name={String(index + 1)}
						value={childValue}
						depth={depth + 1}
					/>
				))}
			</Disclosure>
		);
	}
	return (
		<View style={{ paddingLeft: depth * 16 }}>
			<ValueRow title={prettyKey(name)} value={jsonDisplayString(value)} />
		</View>
	);
}

function MessageRow({ icon, text, color }: { icon: string; text: string; color: string }) {
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 12,
				minHeight: 48,
				paddingHorizontal: 16,
				paddingVertical: 8
			}}
		>
			<Icon name={icon} size={20} color={color} />
			<Text selectable style={[m3Type.bodyLarge, { color, flex: 1 }]}>
				{text}
			</Text>
		</View>
	);
}

export function DynamicResourceDetailScreen() {
	const model = useDynamicResourceDetail();
	const menu: AndroidMenuItem[] = [];
	if (model.canEdit) menu.push({ id: 'edit', title: 'Edit', onPress: model.presentEdit });
	for (const action of model.actions) {
		menu.push({
			id: action.id,
			title: action.title,
			destructive: action.destructive,
			onPress: () => void model.run(action)
		});
	}
	return (
		<>
			<Stack.Screen options={{ title: model.title }} />
			{model.showsMenu ? (
				<AndroidToolbar
					items={[
						{ kind: 'menu', id: 'actions', icon: 'ellipsis.circle', label: 'Actions', items: menu }
					]}
				/>
			) : null}
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 24 }}
			>
				{model.actionMessage !== undefined ? (
					<M3Section>
						<MessageRow
							icon="checkmark.circle"
							text={model.actionMessage}
							color={systemColors.green}
						/>
					</M3Section>
				) : null}
				{model.errorMessage !== undefined ? (
					<M3Section>
						<MessageRow
							icon="exclamationmark.triangle"
							text={model.errorMessage}
							color={systemColors.red}
						/>
					</M3Section>
				) : null}
				<M3Section title="Details">
					{model.details.map(([key, value]) => (
						<DynamicValueRow key={key} name={key} value={value} />
					))}
				</M3Section>
			</ScrollView>
		</>
	);
}
