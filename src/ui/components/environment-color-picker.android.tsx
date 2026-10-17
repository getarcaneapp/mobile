import { Host } from '@expo/ui';
import { ModalBottomSheet, RNHostView } from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { colors } from '@/theme/colors';

import { AccentColorMenu, CustomAccentColorPicker } from './accent-color-menu';
import {
	useEnvironmentColorPicker,
	type EnvironmentColorPickerProps
} from './environment-color-picker.types';
import { m3Type } from './type-scale';

export function EnvironmentColorPicker({
	environmentID,
	displayName
}: EnvironmentColorPickerProps) {
	const picker = useEnvironmentColorPicker(environmentID);
	const [showCustomColor, setShowCustomColor] = useState(false);
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				minHeight: 56,
				paddingHorizontal: 16
			}}
		>
			<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]} numberOfLines={1}>
				{displayName}
			</Text>
			<AccentColorMenu
				selection={picker.selectedHex}
				onSelectionChange={picker.save}
				isAvailable={picker.isAvailable}
				onCustom={() => setShowCustomColor(true)}
			/>
			{showCustomColor ? (
				<Host style={{ position: 'absolute' }}>
					<ModalBottomSheet onDismissRequest={() => setShowCustomColor(false)} showDragHandle>
						<RNHostView matchContents={{ vertical: true }}>
							<View style={{ paddingBottom: 24 }}>
								<CustomAccentColorPicker
									selection={picker.selectedHex}
									onSelectionChange={picker.save}
								/>
							</View>
						</RNHostView>
					</ModalBottomSheet>
				</Host>
			) : null}
		</View>
	);
}
