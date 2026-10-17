import { Host } from '@/ui/host';
import { Button, HStack, List, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	buttonStyle,
	disabled,
	environment,
	font,
	foregroundStyle,
	opacity
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import { DashboardTotalsTile } from '@/features/dashboard/dashboard-logic';
import { systemColors } from '@/theme/colors';
import { RowIcon } from '@/ui/components/row-icon';

import { DashboardTilesCopy, useDashboardTilesEditor } from './use-dashboard-tiles-editor';

function TileRow({ tile }: { tile: DashboardTotalsTile }) {
	const info = DashboardTotalsTile.info[tile];
	return (
		<HStack spacing={12}>
			<RowIcon systemImage={info.systemImage} tint={systemColors[info.tint]} size={30} />
			<VStack alignment="leading" spacing={2}>
				<Text>{info.title}</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{info.detail}
				</Text>
			</VStack>
			<Spacer minLength={0} />
		</HStack>
	);
}

export function DashboardTilesEditorScreen() {
	const model = useDashboardTilesEditor();
	return (
		<>
			<Stack.Screen options={{ title: 'Dashboard Tiles', headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<List modifiers={[environment('editMode', 'active')]}>
					<Section
						header={<Text>Shown</Text>}
						footer={<Text>{DashboardTilesCopy.shownFooter}</Text>}
					>
						<List.ForEach onMove={model.move} onDelete={model.remove}>
							{model.tiles.map((tile) => (
								<HStack key={`shown.${tile}`}>
									<TileRow tile={tile} />
								</HStack>
							))}
						</List.ForEach>
					</Section>
					{model.available.length > 0 ? (
						<Section title="Available">
							{model.available.map((tile) => (
								<Button
									key={`available.${tile}`}
									onPress={() => model.add(tile)}
									modifiers={[
										buttonStyle('plain'),
										disabled(model.isFull),
										opacity(model.isFull ? 0.4 : 1)
									]}
								>
									<HStack>
										<TileRow tile={tile} />
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
					<Section>
						<Button
							label="Reset to Defaults"
							systemImage="arrow.counterclockwise"
							onPress={model.reset}
						/>
					</Section>
				</List>
			</Host>
		</>
	);
}
