/**
 * Android ports of `AdaptiveMetadataGrid`, `MonospacedValue` and
 * `PartialDataNotice`.
 *
 * Standalone (RN views).
 */
import { useState } from 'react';
import { Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';

import {
	adaptiveColumns,
	chunk,
	metadataAccessibilityLabel,
	metadataItemID,
	type ResourceMetadataItem
} from './resource-detail.types';
import { m3Type, monoFamily } from './type-scale';

export function AdaptiveMetadataGrid({ items }: { items: ResourceMetadataItem[] }) {
	const [width, setWidth] = useState(0);
	const columns = width > 0 ? adaptiveColumns(width) : 2;
	return (
		<View
			onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
			style={{ gap: 14, paddingVertical: 4 }}
		>
			{chunk(items, columns).map((row, rowIndex) => (
				<View key={rowIndex} style={{ flexDirection: 'row', gap: 8 }}>
					{Array.from({ length: columns }, (_, column) => {
						const item = row[column];
						if (!item) return <View key={`empty-${column}`} style={{ flex: 1 }} />;
						return (
							<View
								key={metadataItemID(item)}
								accessible
								accessibilityLabel={metadataAccessibilityLabel(item)}
								style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 9 }}
							>
								<View style={{ width: 22, alignItems: 'center' }}>
									<Icon
										name={item.systemImage}
										size={18}
										color={item.tint ?? colors.secondaryLabel}
									/>
								</View>
								<View style={{ flex: 1, gap: 2 }}>
									<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
										{item.label}
									</Text>
									<Text
										numberOfLines={2}
										selectable={item.monospaced}
										style={[
											m3Type.titleSmall,
											{ color: colors.label },
											item.monospaced && { fontFamily: monoFamily }
										]}
									>
										{item.value}
									</Text>
									{item.status ? (
										<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>
											{item.status}
										</Text>
									) : null}
								</View>
							</View>
						);
					})}
				</View>
			))}
		</View>
	);
}

export function MonospacedValue({ value, lineLimit }: { value: string; lineLimit?: number }) {
	return (
		<Text
			numberOfLines={lineLimit}
			ellipsizeMode="middle"
			style={{ fontFamily: monoFamily, fontSize: 15, color: colors.label }}
		>
			{value}
		</Text>
	);
}

export function PartialDataNotice({ message }: { message: string }) {
	return (
		<View accessible style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
			<Icon name="exclamationmark.triangle" size={18} color={colors.secondaryLabel} />
			<Text style={[m3Type.bodyMedium, { flex: 1, color: colors.secondaryLabel }]}>{message}</Text>
		</View>
	);
}
