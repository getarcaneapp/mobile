/** Port of `PreviewFeaturesView` (PreviewFeaturesView.swift). */
import { Host } from '@/ui/host';
import { Button, HStack, List, Section, Spacer, Text, Toggle } from '@expo/ui/swift-ui';
import { foregroundStyle, listStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import { DisclosureChevron } from '@/ui/settings-row';

import { PreviewFeaturesCopy, usePreviewFeatures } from './use-preview-features';

/** `NavigationLink("Title")` row. */
function LinkRow({ title, onPress }: { title: string; onPress: () => void }) {
	return (
		<Button onPress={onPress}>
			<HStack>
				<Text modifiers={[foregroundStyle('primary')]}>{title}</Text>
				<Spacer />
				<DisclosureChevron />
			</HStack>
		</Button>
	);
}

export function PreviewFeaturesScreen() {
	const model = usePreviewFeatures();
	return (
		<>
			<Stack.Screen options={{ title: 'Preview Features', headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<List modifiers={[listStyle('insetGrouped')]}>
					<Section footer={<Text>{PreviewFeaturesCopy.composeFooter}</Text>}>
						<Toggle
							label="Native Compose Editor"
							isOn={model.nativeComposeEditor}
							onIsOnChange={model.setNativeComposeEditor}
						/>
					</Section>
					<Section footer={<Text>{PreviewFeaturesCopy.dashboardFooter}</Text>}>
						<Toggle
							label="Refreshed Dashboard"
							isOn={model.refreshedDashboardPreview}
							onIsOnChange={model.setRefreshedDashboardPreview}
						/>
						<Button label="Replay Walkthrough" onPress={model.showDashboardIntroduction} />
						{model.refreshedDashboardPreview ? (
							<LinkRow title="Edit Tiles" onPress={model.openTilesEditor} />
						) : null}
					</Section>
					<Section footer={<Text>{PreviewFeaturesCopy.allEnvironmentsFooter}</Text>}>
						<Toggle
							label="All Environments"
							isOn={model.allEnvironmentsPreview}
							onIsOnChange={model.setAllEnvironmentsPreview}
						/>
						<Button label="Replay Walkthrough" onPress={model.showIntroduction} />
						<LinkRow title="Environment Colors" onPress={model.openEnvironmentColors} />
					</Section>
				</List>
			</Host>
		</>
	);
}
