/**
 * Port of `ErrorBanner` (Android): Material 3 error / warning container with
 * an optional Retry text button.
 *
 * Standalone (RN view).
 */
import { Pressable, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';

import { errorBannerAccessibilityPrefix, type ErrorBannerProps } from './error-banner.types';
import { m3 } from './material-colors';
import { m3Type } from './type-scale';

export function ErrorBanner({ message, severity = 'error', retry }: ErrorBannerProps) {
	const container = severity === 'error' ? m3.errorContainer : `${systemColors.orange}26`;
	const content = severity === 'error' ? m3.onErrorContainer : colors.label;
	return (
		<View
			accessible
			accessibilityLabel={errorBannerAccessibilityPrefix[severity] + message}
			style={{
				flexDirection: 'row',
				alignItems: 'flex-start',
				gap: 12,
				padding: 12,
				borderRadius: Radius.nested,
				backgroundColor: container
			}}
		>
			<Icon
				name="exclamationmark.triangle.fill"
				size={20}
				color={severity === 'error' ? m3.error : systemColors.orange}
			/>
			<Text style={[m3Type.bodyMedium, { flex: 1, color: content }]}>{message}</Text>
			{retry ? (
				<Pressable onPress={retry} accessibilityRole="button" hitSlop={8}>
					<Text
						style={[m3Type.labelLarge, { color: severity === 'error' ? m3.error : m3.primary }]}
					>
						Retry
					</Text>
				</Pressable>
			) : null}
		</View>
	);
}
