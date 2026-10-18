import { BottomSheet, Form, HStack, Section, Spacer, Text } from '@expo/ui/swift-ui';
import { presentationDetents, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';

import { AccentColorMenu, CustomAccentColorPicker } from './accent-color-menu';
import {
	useEnvironmentColorPicker,
	type EnvironmentColorPickerProps
} from './environment-color-picker.types';

export function EnvironmentColorPicker({
	environmentID,
	displayName
}: EnvironmentColorPickerProps) {
	const picker = useEnvironmentColorPicker(environmentID);
	const [showCustomColor, setShowCustomColor] = useState(false);
	return (
		<BottomSheet
			isPresented={showCustomColor}
			onIsPresentedChange={setShowCustomColor}
			anchor={
				<HStack>
					<Text>{displayName}</Text>
					<Spacer />
					<AccentColorMenu
						selection={picker.selectedHex}
						onSelectionChange={picker.save}
						isAvailable={picker.isAvailable}
						onCustom={() => setShowCustomColor(true)}
						unnamedTitle={picker.unnamedTitle}
						accessibilityLabel={`${displayName} color`}
					/>
				</HStack>
			}
		>
			<Form
				modifiers={[presentationDetents(['medium', 'large']), presentationDragIndicator('visible')]}
			>
				<Section>
					<CustomAccentColorPicker selection={picker.selectedHex} onSelectionChange={picker.save} />
				</Section>
			</Form>
		</BottomSheet>
	);
}
