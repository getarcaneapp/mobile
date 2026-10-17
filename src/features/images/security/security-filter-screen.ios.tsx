/** AllVulnerabilitiesView's Filters sheet (`filterSheet`, AllVulnerabilitiesView.swift). */
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import { Host } from '@/ui/host';
import {
	Button,
	Form,
	HStack,
	NavigationStack,
	Picker,
	Section,
	Text,
	Toggle,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import { navigationBarTitleDisplayMode, navigationTitle, tag } from '@expo/ui/swift-ui/modifiers';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { EnvironmentFilterSection } from '@/ui/components/environment-label';

import { securityFilterActions, useSecurityFilter } from './security-filter-store';
import { SeverityBadge } from './vulnerability-rows';
import { severityDisplayLabel, VulnerabilitySeverities } from './vulnerability-model';

const allImagesTag = '__all_images__';

export function SecurityFilterScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const router = useRouter();
	const { key = '' } = useLocalSearchParams<{ key?: string }>();
	const filter = useSecurityFilter(key);
	const actions = securityFilterActions(key);

	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar>
					<Form modifiers={[navigationTitle('Filters'), navigationBarTitleDisplayMode('inline')]}>
						<EnvironmentFilterSection
							environments={filter.environments}
							selection={filter.environmentFilter}
							onSelectionChange={(id) => actions.update({ environmentFilter: id })}
						/>
						<Section title="Severity">
							{VulnerabilitySeverities.map((severity) => (
								<Toggle
									key={severity}
									isOn={filter.selectedSeverities.includes(severity)}
									onIsOnChange={(isOn) => actions.toggleSeverity(severity, isOn)}
								>
									<HStack>
										<SeverityBadge severity={severity} />
										<Text>{severityDisplayLabel(severity)}</Text>
									</HStack>
								</Toggle>
							))}
						</Section>
						{filter.imageOptions.length > 0 ? (
							<Section title="Image">
								<Picker
									label="Image"
									selection={filter.selectedImage ?? allImagesTag}
									onSelectionChange={(value: string) =>
										actions.update({ selectedImage: value === allImagesTag ? undefined : value })
									}
								>
									<Text modifiers={[tag(allImagesTag)]}>All</Text>
									{filter.imageOptions.map((name) => (
										<Text key={name} modifiers={[tag(name)]}>
											{name}
										</Text>
									))}
								</Picker>
							</Section>
						) : null}
						<Section title="Options">
							<Toggle
								label="Only with fix available"
								isOn={filter.onlyFixAvailable}
								onIsOnChange={(isOn) => actions.update({ onlyFixAvailable: isOn })}
							/>
						</Section>
					</Form>
					<Toolbar.Content>
						<ToolbarItem placement="cancellationAction">
							<Button label="Reset" onPress={actions.reset} modifiers={toolbarSymbol} />
						</ToolbarItem>
						<ToolbarItem placement="confirmationAction">
							<Button
								label="Done"
								onPress={() => {
									actions.done();
									router.back();
								}}
								modifiers={toolbarSymbol}
							/>
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}
