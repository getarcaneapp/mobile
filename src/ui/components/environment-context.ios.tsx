import { Host } from '@/ui/host';
import {
	Button,
	ContentUnavailableView,
	HStack,
	List,
	NavigationStack,
	Spacer,
	Text,
	Toolbar,
	ToolbarItem,
	VStack,
	ZStack,
	useNativeState
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityAddTraits,
	accessibilityHidden,
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	navigationBarTitleDisplayMode,
	navigationTitle,
	opacity,
	searchable,
	shapes,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';

import { useAccentColor } from '@/theme/accent';

import {
	filterEnvironments,
	type EnvironmentContextPickerProps
} from './environment-context.types';
import { ResourceStatusBadge } from './resource-status-badge';

export { EnvironmentSwitcherToolbarButton } from './environment-switcher-button';

export function EnvironmentContextPicker({
	environments,
	activeEnvironmentID,
	onSelect,
	onCancel
}: EnvironmentContextPickerProps) {
	const accent = useAccentColor();
	const [search, setSearch] = useState('');
	const searchText = useNativeState('');
	const filtered = filterEnvironments(environments, search);

	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar
					modifiers={[
						navigationTitle('Choose Environment'),
						navigationBarTitleDisplayMode('inline'),
						searchable(searchText, { prompt: 'Search environments', onChange: setSearch })
					]}
				>
					<ZStack>
						<List>
							{filtered.map((environment) => {
								const isActive = environment.id === activeEnvironmentID;
								return (
									<Button
										key={environment.id}
										onPress={() => onSelect(environment)}
										modifiers={[
											buttonStyle('plain'),
											...(isActive ? [accessibilityAddTraits(['isSelected'])] : [])
										]}
									>
										<HStack spacing={12} modifiers={[contentShape(shapes.rectangle())]}>
											<Image
												systemName="checkmark"
												modifiers={[
													font({ weight: 'semibold' }),
													foregroundStyle(accent),
													frame({ width: 18 }),
													opacity(isActive ? 1 : 0),
													accessibilityHidden(true)
												]}
											/>
											<VStack alignment="leading" spacing={3}>
												<Text modifiers={[foregroundStyle('primary')]}>
													{environment.displayName}
												</Text>
												<Text
													modifiers={[
														font({ textStyle: 'caption' }),
														foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
														lineLimit(1),
														truncationMode('middle')
													]}
												>
													{environment.apiUrl}
												</Text>
											</VStack>
											<Spacer />
											<ResourceStatusBadge status={environment.status} usesCardStyle />
										</HStack>
									</Button>
								);
							})}
						</List>
						{filtered.length === 0 ? (
							<ContentUnavailableView
								title={`No Results for “${search}”`}
								systemImage="magnifyingglass"
								description="Check the spelling or try a new search."
							/>
						) : null}
					</ZStack>
					<Toolbar.Content>
						<ToolbarItem placement="cancellationAction">
							<Button label="Cancel" onPress={onCancel} modifiers={[foregroundStyle(accent)]} />
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}
