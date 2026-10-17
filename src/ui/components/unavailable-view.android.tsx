/**
 * Android `ContentUnavailableView` with any number of text-button actions.
 *
 * Standalone (RN views).
 */
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import type { UnavailableViewProps } from './unavailable-view.types';

export type { UnavailableAction, UnavailableViewProps } from './unavailable-view.types';

export function UnavailableView({
	title,
	systemImage,
	description,
	actions = [],
	fills = true,
	children
}: UnavailableViewProps) {
	return (
		<View
			style={{
				flex: fills ? 1 : undefined,
				alignItems: 'center',
				justifyContent: 'center',
				padding: 32,
				gap: 8
			}}
		>
			<Icon name={systemImage} size={44} color={colors.secondaryLabel} />
			<Text style={[m3Type.titleLarge, { color: colors.label, textAlign: 'center' }]}>{title}</Text>
			{description ? (
				<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}>
					{description}
				</Text>
			) : null}
			{actions.map((action) =>
				action.isBusy ? (
					<ActivityIndicator
						key={action.title}
						color={m3.primary as string}
						style={{ marginTop: 8 }}
					/>
				) : (
					<Pressable
						key={action.title}
						onPress={action.onPress}
						disabled={action.disabled}
						accessibilityRole="button"
						android_ripple={{ color: colors.separator as string }}
						style={{
							marginTop: 4,
							paddingHorizontal: 16,
							paddingVertical: 10,
							borderRadius: 20,
							opacity: action.disabled ? 0.5 : 1
						}}
					>
						<Text style={[m3Type.labelLarge, { color: m3.primary }]}>{action.title}</Text>
					</Pressable>
				)
			)}
			{children}
		</View>
	);
}
