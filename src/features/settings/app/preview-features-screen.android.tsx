import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';

import { colors } from '@/theme/colors';
import { MaterialListItem } from '@/ui/material/list';

import { M3Section, SwitchRow, TextButtonRow } from '../shared/android-material';
import { PreviewFeaturesCopy, usePreviewFeatures } from './use-preview-features';

export function PreviewFeaturesScreen() {
	const model = usePreviewFeatures();
	return (
		<>
			<Stack.Screen options={{ title: 'Preview Features' }} />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 24 }}
			>
				<M3Section footer={PreviewFeaturesCopy.composeFooter}>
					<SwitchRow
						title="Native Compose Editor"
						value={model.nativeComposeEditor}
						onValueChange={model.setNativeComposeEditor}
					/>
				</M3Section>
				{model.usesV3Defaults ? (
					<M3Section>
						<MaterialListItem headline="Edit Dashboard" onPress={model.openDashboardEditor} />
						<MaterialListItem headline="Environment Colors" onPress={model.openEnvironmentColors} />
					</M3Section>
				) : (
					<>
						<M3Section footer={PreviewFeaturesCopy.dashboardFooter}>
							<SwitchRow
								title="Refreshed Dashboard"
								value={model.refreshedDashboardPreview}
								onValueChange={model.setRefreshedDashboardPreview}
							/>
							<TextButtonRow title="Replay Walkthrough" onPress={model.showDashboardIntroduction} />
							{model.refreshedDashboardPreview ? (
								<MaterialListItem headline="Edit Dashboard" onPress={model.openDashboardEditor} />
							) : null}
						</M3Section>
						<M3Section footer={PreviewFeaturesCopy.allEnvironmentsFooter}>
							<SwitchRow
								title="All Environments"
								value={model.allEnvironmentsPreview}
								onValueChange={model.setAllEnvironmentsPreview}
							/>
							<TextButtonRow title="Replay Walkthrough" onPress={model.showIntroduction} />
							<MaterialListItem
								headline="Environment Colors"
								onPress={model.openEnvironmentColors}
							/>
						</M3Section>
					</>
				)}
			</ScrollView>
		</>
	);
}
