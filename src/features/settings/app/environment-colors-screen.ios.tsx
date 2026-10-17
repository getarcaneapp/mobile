import { Host } from '@/ui/host';
import {
	BottomSheet,
	Button,
	Form,
	HStack,
	List,
	NavigationStack,
	Section,
	Spacer,
	SwipeActions,
	Text
} from '@expo/ui/swift-ui';
import { foregroundStyle, presentationDetents } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import { AccentColorMenu, CustomAccentColorPicker } from '@/ui/components/accent-color-menu';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';

import {
	EnvironmentColorsCopy,
	useEnvironmentColor,
	useEnvironmentColors
} from './use-environment-colors';

function EnvironmentColorPicker({
	environment,
	onReset
}: {
	environment: Environment;
	onReset: () => void;
}) {
	const model = useEnvironmentColor(environment);
	const [showCustomColor, setShowCustomColor] = useState(false);
	return (
		<SwipeActions>
			<HStack>
				<Text>{model.name}</Text>
				<Spacer />
				<AccentColorMenu
					selection={model.selectedHex}
					onSelectionChange={model.save}
					isAvailable={model.isAvailable}
					onCustom={() => setShowCustomColor(true)}
				/>
				<BottomSheet isPresented={showCustomColor} onIsPresentedChange={setShowCustomColor}>
					<NavigationStack modifiers={[presentationDetents(['medium', 'large'])]}>
						<Form>
							<CustomAccentColorPicker
								selection={model.selectedHex}
								onSelectionChange={model.save}
							/>
						</Form>
					</NavigationStack>
				</BottomSheet>
			</HStack>
			<SwipeActions.Actions edge="trailing">
				<Button label="Reset" onPress={onReset} />
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

export function EnvironmentColorsScreen() {
	const model = useEnvironmentColors();
	return (
		<>
			<Stack.Screen options={{ title: 'Environment Colors', headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<List>
					<Section footer={<Text>{EnvironmentColorsCopy.footer}</Text>}>
						{model.environments.map((environment) => (
							<EnvironmentColorPicker
								key={environment.id}
								environment={environment}
								onReset={() => model.reset(environment)}
							/>
						))}
					</Section>
					{model.errorMessage ? (
						<>
							<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
								{model.errorMessage}
							</Text>
							<Button label="Retry" onPress={model.retry} />
						</>
					) : null}
				</List>
			</Host>
			{model.showsLoading ? (
				<View
					pointerEvents="none"
					style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}
				>
					<ArcaneLoadingView />
				</View>
			) : null}
		</>
	);
}
