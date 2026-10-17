import { Host } from '@/ui/host';
import {
	Button,
	Form,
	NavigationStack,
	Section,
	Text,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import {
	foregroundStyle,
	navigationBarTitleDisplayMode,
	navigationTitle
} from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useAccentColor } from '@/theme/accent';
import { EnvironmentColorPicker } from '@/ui/components/environment-color-picker';
import { useEnvironmentColorPicker } from '@/ui/components/environment-color-picker.types';
import { ToastHost } from '@/ui/toast';

import { useEnvironmentColorRoute } from './environment-color-model';

export function EnvironmentColorScreen() {
	const router = useRouter();
	const accent = useAccentColor();
	const route = useEnvironmentColorRoute();
	const picker = useEnvironmentColorPicker(route.environmentID);
	return (
		<View style={{ flex: 1 }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[
								navigationTitle('Environment Color'),
								navigationBarTitleDisplayMode('inline')
							]}
						>
							<Section
								footer={<Text>Applies to this environment's name and icon in resource lists.</Text>}
							>
								<EnvironmentColorPicker
									environmentID={route.environmentID}
									displayName={route.displayName}
								/>
								<Button label="Reset Color" onPress={picker.reset} />
							</Section>
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="confirmationAction">
								<Button
									label="Done"
									onPress={() => router.back()}
									modifiers={[foregroundStyle(accent)]}
								/>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
