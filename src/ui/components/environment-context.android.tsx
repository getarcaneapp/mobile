import { useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { useAccentColor } from '@/theme/accent';
import { colors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';

import {
	filterEnvironments,
	type EnvironmentContextPickerProps
} from './environment-context.types';
import { m3 } from './material-colors';
import { ResourceStatusBadge } from './resource-status-badge';
import { m3Type } from './type-scale';

export { EnvironmentSwitcherToolbarButton } from './environment-switcher-button';

export function EnvironmentContextPicker({
	environments,
	activeEnvironmentID,
	onSelect,
	onCancel
}: EnvironmentContextPickerProps) {
	const accent = useAccentColor();
	const [search, setSearch] = useState('');
	const filtered = filterEnvironments(environments, search);

	return (
		<View style={{ flex: 1, backgroundColor: m3.surfaceContainerHigh }}>
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					paddingHorizontal: 8,
					paddingTop: 8,
					minHeight: 56
				}}
			>
				<Pressable
					onPress={onCancel}
					accessibilityRole="button"
					accessibilityLabel="Cancel"
					hitSlop={8}
					style={{ padding: 12 }}
				>
					<Icon name="xmark" size={24} color={colors.label} />
				</Pressable>
				<Text style={[m3Type.titleLarge, { color: colors.label, flex: 1 }]}>
					Choose Environment
				</Text>
			</View>
			<View
				style={{
					marginHorizontal: 16,
					marginVertical: 8,
					flexDirection: 'row',
					alignItems: 'center',
					gap: 12,
					paddingHorizontal: 16,
					height: 56,
					borderRadius: 28,
					backgroundColor: m3.surfaceContainerHighest
				}}
			>
				<Icon name="magnifyingglass" size={24} color={m3.onSurfaceVariant} />
				<TextInput
					value={search}
					onChangeText={setSearch}
					placeholder="Search environments"
					placeholderTextColor={m3.onSurfaceVariant as string}
					autoCapitalize="none"
					autoCorrect={false}
					style={[m3Type.bodyLarge, { flex: 1, color: colors.label }]}
				/>
			</View>
			{filtered.length === 0 ? (
				<View style={{ alignItems: 'center', padding: 48, gap: 8 }}>
					<Icon name="magnifyingglass" size={40} color={colors.secondaryLabel} />
					<Text
						style={[m3Type.titleLarge, { color: colors.label }]}
					>{`No results for “${search}”`}</Text>
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
						Check the spelling or try a new search.
					</Text>
				</View>
			) : (
				<FlatList
					data={filtered}
					keyExtractor={(e) => e.id}
					keyboardShouldPersistTaps="handled"
					renderItem={({ item }) => {
						const isActive = item.id === activeEnvironmentID;
						return (
							<Pressable
								onPress={() => onSelect(item)}
								accessibilityRole="button"
								accessibilityState={{ selected: isActive }}
								android_ripple={{ color: colors.separator as string }}
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									gap: 16,
									minHeight: 72,
									paddingHorizontal: 16,
									paddingVertical: 8
								}}
							>
								<View
									style={{ width: 24, opacity: isActive ? 1 : 0 }}
									importantForAccessibility="no-hide-descendants"
								>
									<Icon name="checkmark" size={24} color={accent} />
								</View>
								<View style={{ flex: 1, gap: 2 }}>
									<Text numberOfLines={1} style={[m3Type.bodyLarge, { color: colors.label }]}>
										{item.displayName}
									</Text>
									<Text
										numberOfLines={1}
										ellipsizeMode="middle"
										style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}
									>
										{item.apiUrl}
									</Text>
								</View>
								<ResourceStatusBadge status={item.status} usesCardStyle />
							</Pressable>
						);
					}}
				/>
			)}
		</View>
	);
}
