/**
 * Android ports of `RunEndpointButton` (Material 3 filled button, error
 * container when destructive) and `DynamicNavigationRow` (two-line list item).
 *
 * Standalone (RN views).
 */
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';
import { MaterialListItem } from '@/ui/material/list';

import { m3 } from './material-colors';
import {
	defaultFormatError,
	type DynamicNavigationRowProps,
	type RunEndpointButtonProps
} from './rows.types';
import { m3Type } from './type-scale';

export function RunEndpointButton({
	title,
	systemImage,
	run,
	destructive = false,
	formatError = defaultFormatError
}: RunEndpointButtonProps) {
	const [isRunning, setIsRunning] = useState(false);
	const [message, setMessage] = useState<string>();
	const container = destructive ? m3.error : m3.primary;

	const onPress = async () => {
		setIsRunning(true);
		try {
			await run();
			setMessage('Completed');
		} catch (error) {
			setMessage(formatError(error));
		} finally {
			setIsRunning(false);
		}
	};

	return (
		<View style={{ gap: 6, alignItems: 'flex-start' }}>
			<Pressable
				onPress={() => void onPress()}
				disabled={isRunning}
				accessibilityRole="button"
				accessibilityState={{ disabled: isRunning, busy: isRunning }}
				android_ripple={{ color: '#FFFFFF33' }}
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					gap: 8,
					height: 40,
					paddingHorizontal: 24,
					borderRadius: 20,
					overflow: 'hidden',
					backgroundColor: container,
					opacity: isRunning ? 0.6 : 1
				}}
			>
				{isRunning ? (
					<ActivityIndicator size="small" color={m3.onPrimary} />
				) : (
					<Icon name={systemImage} size={18} color={m3.onPrimary} />
				)}
				<Text style={[m3Type.labelLarge, { color: m3.onPrimary }]}>
					{isRunning ? 'Running...' : title}
				</Text>
			</Pressable>
			{message ? (
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>{message}</Text>
			) : null}
		</View>
	);
}

export function DynamicNavigationRow({
	title,
	subtitle,
	systemImage,
	onPress
}: DynamicNavigationRowProps) {
	return (
		<MaterialListItem
			headline={title}
			supporting={subtitle}
			icon={systemImage}
			onPress={onPress}
			trailing={<Icon name="chevron.right" size={20} color={colors.secondaryLabel} />}
		/>
	);
}
