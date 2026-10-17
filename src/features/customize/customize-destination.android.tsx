import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';

import { iconColor, systemImage, tabTitle } from '@/core/app-tab';
import { CenteredMessage, M3Section } from '@/features/settings/shared/android-material';
import { colors, systemColors } from '@/theme/colors';
import { MaterialListItem } from '@/ui/material/list';

import { useNavigationCatalog } from './use-navigation-catalog';

const parent = 'customize';

export function CustomizeDestination() {
	const { children, open } = useNavigationCatalog(parent);
	return (
		<>
			<Stack.Screen options={{ title: tabTitle[parent] }} />
			{children.length === 0 ? (
				<CenteredMessage
					icon={systemImage[parent]}
					title="No Available Sections"
					message="Your account does not have access to any sections here."
				/>
			) : (
				<ScrollView
					contentInsetAdjustmentBehavior="automatic"
					style={{ backgroundColor: colors.systemGroupedBackground }}
					contentContainerStyle={{ paddingBottom: 24 }}
				>
					<M3Section title={tabTitle[parent]}>
						{children.map((child) => (
							<MaterialListItem
								key={child}
								headline={tabTitle[child]}
								icon={systemImage[child]}
								iconColor={systemColors[iconColor(child)]}
								onPress={() => open(child)}
							/>
						))}
					</M3Section>
				</ScrollView>
			)}
		</>
	);
}
