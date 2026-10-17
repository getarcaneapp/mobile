import { Host } from '@/ui/host';
import {
	Button,
	HStack,
	List,
	RNHostView,
	RoundedRectangle,
	Section,
	Spacer,
	Text,
	VStack,
	ZStack
} from '@expo/ui/swift-ui';
import {
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	frame,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';

import { useAccentColor } from '@/theme/accent';
import { withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { useIsDark } from '@/ui/components/accessibility';
import { Image as SwiftImage } from '@/ui/components/swiftui-image';

import { ActionErrorAlert } from '../shared/action-error-alert';
import { useAppIconPicker } from './use-app-icon-picker';

function useSeparatorStroke(): string {
	return useIsDark() ? withOpacity('#545458', 0.6 * 0.4) : withOpacity('#3C3C43', 0.29 * 0.4);
}

function useTertiaryFill(): string {
	return useIsDark() ? withOpacity('#767680', 0.24) : withOpacity('#767680', 0.12);
}

function IconPreview({ source }: { source: number | undefined }) {
	const stroke = useSeparatorStroke();
	const placeholderFill = useTertiaryFill();
	if (source === undefined) {
		return (
			<ZStack modifiers={[frame({ width: 56, height: 56 })]}>
				<RoundedRectangle
					cornerRadius={Radius.nested}
					modifiers={[foregroundStyle(placeholderFill)]}
				/>
				<SwiftImage
					systemName="questionmark"
					modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
				/>
			</ZStack>
		);
	}
	return (
		<ZStack modifiers={[frame({ width: 56, height: 56 })]}>
			<RNHostView matchContents>
				<Image
					source={source}
					contentFit="contain"
					style={{
						width: 56,
						height: 56,
						borderRadius: Radius.nested,
						borderCurve: 'continuous',
						borderWidth: 0.5,
						borderColor: stroke
					}}
				/>
			</RNHostView>
		</ZStack>
	);
}

export function AppIconPickerScreen() {
	const accent = useAccentColor();
	const model = useAppIconPicker();
	return (
		<>
			<Stack.Screen options={{ title: 'App Icon', headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<List>
					<Section>
						{model.options.map((option) => (
							<Button
								key={option.alternateName ?? '__primary__'}
								onPress={() => model.select(option)}
								modifiers={[buttonStyle('plain')]}
							>
								<HStack spacing={14} modifiers={[contentShape(shapes.rectangle())]}>
									<IconPreview source={option.preview} />
									<VStack alignment="leading" spacing={2}>
										<Text modifiers={[foregroundStyle('primary')]}>{option.displayName}</Text>
										{option.alternateName === undefined ? (
											<Text
												modifiers={[
													font({ textStyle: 'caption' }),
													foregroundStyle({ type: 'hierarchical', style: 'secondary' })
												]}
											>
												Original
											</Text>
										) : null}
									</VStack>
									<Spacer />
									{option.alternateName === model.currentIconName ? (
										<SwiftImage
											systemName="checkmark"
											modifiers={[
												font({ textStyle: 'headline', weight: 'bold' }),
												foregroundStyle(accent)
											]}
										/>
									) : null}
								</HStack>
							</Button>
						))}
					</Section>
				</List>
				<ActionErrorAlert
					title="Couldn't change icon"
					message={model.errorMessage}
					onDismiss={model.clearError}
				/>
			</Host>
		</>
	);
}
