/**
 * Port of `RecoveryCodesSaveView` (PasskeysMFAView.swift). Presented as a
 * sheet with interactive dismissal disabled; draws its own navigation bar.
 */
import { Host } from '@/ui/host';
import { Button, Label, List, NavigationStack, Section, Text } from '@expo/ui/swift-ui';
import {
	background,
	buttonStyle,
	controlSize,
	font,
	foregroundStyle,
	frame,
	listStyle,
	navigationBarTitleDisplayMode,
	navigationTitle,
	padding,
	textSelection
} from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ToastHost } from '@/ui/toast';

import { useRecoveryCodes } from './use-recovery-codes';

export function RecoveryCodesScreen() {
	const model = useRecoveryCodes();
	const insets = useSafeAreaInsets();
	return (
		<View style={{ flex: 1 }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<List
						modifiers={[
							listStyle('insetGrouped'),
							navigationTitle('Save Recovery Codes'),
							navigationBarTitleDisplayMode('inline')
						]}
					>
						<Section>
							<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
								Save these codes somewhere secure. They will not be shown again.
							</Text>
						</Section>
						<Section title="Recovery Codes">
							{model.codes.map((code) => (
								<Text
									key={code}
									modifiers={[
										font({ textStyle: 'body', design: 'monospaced' }),
										textSelection(true)
									]}
								>
									{code}
								</Text>
							))}
						</Section>
						<Section>
							<Button onPress={model.copyAll}>
								<Label title="Copy All Codes" systemImage="doc.on.doc" />
							</Button>
						</Section>
					</List>
				</NavigationStack>
			</Host>
			{/* `.safeAreaInset(edge: .bottom)` confirmation bar. */}
			<Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
				<Button
					label="I've Saved These Codes"
					onPress={model.confirmSaved}
					modifiers={[
						buttonStyle('borderedProminent'),
						controlSize('large'),
						frame({ maxWidth: Infinity }),
						padding({ top: 16, leading: 16, trailing: 16, bottom: 16 + insets.bottom }),
						background({ type: 'material', material: 'bar' })
					]}
				/>
			</Host>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
