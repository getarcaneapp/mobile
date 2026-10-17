/** Android rendering of `AppIconPickerView` (AppIconPickerView.swift): Material 3 radio list. */
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { m3 } from '@/ui/components/material-colors';
import { Icon } from '@/ui/Icon';
import { MaterialListItem } from '@/ui/material/list';

import { ActionErrorAlert } from '../shared/action-error-alert';
import { M3Section } from '../shared/android-material';
import { useAppIconPicker } from './use-app-icon-picker';

function IconPreview({ source }: { source: number | undefined }) {
	if (source === undefined) {
		return (
			<View
				style={{
					width: 56,
					height: 56,
					borderRadius: Radius.nested,
					backgroundColor: m3.surfaceContainerHighest,
					alignItems: 'center',
					justifyContent: 'center'
				}}
			>
				<Icon name="questionmark" size={22} color={colors.secondaryLabel} />
			</View>
		);
	}
	return (
		<Image
			source={source}
			contentFit="contain"
			style={{ width: 56, height: 56, borderRadius: Radius.nested }}
		/>
	);
}

function RadioIndicator({ selected }: { selected: boolean }) {
	return (
		<View
			style={{
				width: 20,
				height: 20,
				borderRadius: 10,
				borderWidth: 2,
				borderColor: selected ? m3.primary : m3.onSurfaceVariant,
				alignItems: 'center',
				justifyContent: 'center'
			}}
		>
			{selected ? (
				<View
					style={{
						width: 10,
						height: 10,
						borderRadius: 5,
						backgroundColor: m3.primary
					}}
				/>
			) : null}
		</View>
	);
}

export function AppIconPickerScreen() {
	const model = useAppIconPicker();
	return (
		<>
			<Stack.Screen options={{ title: 'App Icon' }} />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 24 }}
			>
				<M3Section>
					{model.options.map((option) => (
						<MaterialListItem
							key={option.alternateName ?? '__primary__'}
							headline={option.displayName}
							supporting={option.alternateName === undefined ? 'Original' : undefined}
							leading={<IconPreview source={option.preview} />}
							trailing={
								<RadioIndicator selected={option.alternateName === model.currentIconName} />
							}
							onPress={() => model.select(option)}
						/>
					))}
				</M3Section>
			</ScrollView>
			<ActionErrorAlert
				title="Couldn't change icon"
				message={model.errorMessage}
				onDismiss={model.clearError}
			/>
		</>
	);
}
