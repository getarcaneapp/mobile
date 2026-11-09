import { Host } from '@/ui/host';
import { Button, HStack, List, Section, Spacer, Text } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import { buttonStyle, environment, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import { DashboardWidget, type DashboardWidgetID } from '@/features/dashboard/dashboard-widgets';
import { useDashboardLayout } from '@/features/dashboard/use-dashboard-layout';
import { systemColors } from '@/theme/colors';
import { RowIcon } from '@/ui/components/row-icon';

function WidgetRow({ id }: { id: DashboardWidgetID }) {
	const info = DashboardWidget.info[id];
	return (
		<HStack spacing={12}>
			<RowIcon systemImage={info.systemImage} tint={systemColors[info.tint]} size={30} />
			<Text>{info.title}</Text>
			<Spacer minLength={0} />
		</HStack>
	);
}

export function DashboardWidgetsEditorScreen() {
	const layout = useDashboardLayout();
	return (
		<>
			<Stack.Screen options={{ title: 'Dashboard', headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<List modifiers={[environment('editMode', 'active')]}>
					<Section header={<Text>Shown</Text>}>
						<List.ForEach
							onMove={layout.move}
							onDelete={(indices) =>
								layout.hide(
									indices.flatMap((index) => {
										const entry = layout.visible[index];
										return entry ? [entry.id] : [];
									})
								)
							}
						>
							{layout.visible.map((entry) => (
								<HStack key={`shown.${entry.id}`}>
									<WidgetRow id={entry.id} />
								</HStack>
							))}
						</List.ForEach>
					</Section>
					{layout.hidden.length > 0 ? (
						<Section title="Hidden">
							{layout.hidden.map((entry) => (
								<Button
									key={`hidden.${entry.id}`}
									onPress={() => layout.show(entry.id)}
									modifiers={[buttonStyle('plain')]}
								>
									<HStack>
										<WidgetRow id={entry.id} />
										<Image
											systemName="plus.circle.fill"
											modifiers={[
												foregroundStyle(systemColors.green),
												font({ textStyle: 'title3' })
											]}
										/>
									</HStack>
								</Button>
							))}
						</Section>
					) : null}
					{layout.isCustomized ? (
						<Section>
							<Button
								label="Reset to Defaults"
								systemImage="arrow.counterclockwise"
								onPress={layout.reset}
							/>
						</Section>
					) : null}
				</List>
			</Host>
		</>
	);
}
