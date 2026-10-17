/**
 * Header row for the Updates Material sheets: a leading text action
 * (Cancel / Done / Close) and a centered title. Android only.
 *
 * Standalone (RN view).
 */
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';

export function SheetHeader({
	title,
	actionTitle,
	onAction
}: {
	title: string;
	actionTitle: string;
	onAction: () => void;
}) {
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				paddingHorizontal: 8,
				paddingBottom: 8,
				minHeight: 48
			}}
		>
			<Pressable
				onPress={onAction}
				accessibilityRole="button"
				style={{ paddingHorizontal: 12, paddingVertical: 10 }}
			>
				<Text style={[m3Type.labelLarge, { color: m3.primary }]}>{actionTitle}</Text>
			</Pressable>
			<Text
				style={[
					m3Type.titleMedium,
					{ color: colors.label, flex: 1, textAlign: 'center', marginRight: 72 }
				]}
				numberOfLines={1}
			>
				{title}
			</Text>
		</View>
	);
}
