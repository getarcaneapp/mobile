import { Host } from '@/ui/host';
import {
	Button,
	ContentUnavailableView,
	HStack,
	LabeledContent,
	List,
	ScrollView,
	Section,
	Spacer,
	Text,
	VStack,
	Label
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityElement,
	accessibilityLabel,
	buttonStyle,
	defaultScrollAnchorForRole,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	listStyle,
	padding,
	contentShape,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Alert, View } from 'react-native';

import { formattedISO8601 } from '@/core/date-formatting';
import type { FileEntry } from '@/sdk/models/volume/Browse';
import { useAccentColor } from '@/theme/accent';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { secondaryHex, useIsDark } from '@/ui/components/accessibility';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { RowIcon } from '@/ui/components/row-icon';
import { glassChipCompat, glassEffectCompat } from '@/ui/components/swiftui-surfaces';
import { AppToolbar } from '@/ui/components/toolbar';
import { DisclosureChevron } from '@/ui/settings-row';
import { useToolbarIcons } from '@/ui/toolbar-icon';

import { useVolumeBrowser, type VolumeBrowserModel } from './use-volume-browser';
import { byteString, relativeNamed } from './volume-model';
import { volumeCache } from './volume-routes';

function BreadcrumbChip({
	title,
	isCurrent,
	accent,
	onPress
}: {
	title: string;
	isCurrent: boolean;
	accent: string;
	onPress: () => void;
}) {
	return (
		<Button
			onPress={onPress}
			modifiers={[
				buttonStyle('plain'),
				foregroundStyle(isCurrent ? '#FFFFFF' : 'primary'),
				isCurrent
					? glassChipCompat({ tint: accent, interactive: true, shape: 'capsule' })
					: glassEffectCompat({ interactive: true, shape: 'capsule' }),
				accessibilityLabel(title === '/' ? 'Root folder' : title)
			]}
		>
			<Text
				modifiers={[
					font({ textStyle: 'caption', weight: 'semibold' }),
					lineLimit(1),
					padding({ horizontal: 12 }),
					frame({ height: 34 })
				]}
			>
				{title}
			</Text>
		</Button>
	);
}

function BreadcrumbBar({ model }: { model: VolumeBrowserModel }) {
	const accent = useAccentColor();
	const { segments } = model;
	return (
		<View style={{ height: 50, backgroundColor: colors.systemGroupedBackground }}>
			<Host style={{ flex: 1 }}>
				<HStack spacing={8} modifiers={[padding({ horizontal: 12 })]}>
					{segments.length > 0 ? (
						<Button
							onPress={model.goUp}
							modifiers={[
								buttonStyle('plain'),
								foregroundStyle(accent),
								glassEffectCompat({ interactive: true, shape: 'capsule' }),
								accessibilityLabel('Up one level')
							]}
						>
							<Image
								systemName="arrow.turn.left.up"
								modifiers={[
									font({ textStyle: 'subheadline', weight: 'semibold' }),
									frame({ width: 34, height: 34 })
								]}
							/>
						</Button>
					) : null}
					<ScrollView
						key={model.currentPath}
						axes="horizontal"
						showsIndicators={false}
						modifiers={[defaultScrollAnchorForRole('trailing', 'initialOffset')]}
					>
						<HStack spacing={8} modifiers={[padding({ horizontal: 16, vertical: 8 })]}>
							<BreadcrumbChip
								title="/"
								isCurrent={segments.length === 0}
								accent={accent}
								onPress={model.goToRoot}
							/>
							{segments.map((segment, index) => (
								<BreadcrumbChip
									key={`segment-${index}`}
									title={segment}
									isCurrent={index === segments.length - 1}
									accent={accent}
									onPress={() => model.goToSegment(index)}
								/>
							))}
						</HStack>
					</ScrollView>
				</HStack>
			</Host>
		</View>
	);
}

function VolumeBrowserRow({ entry }: { entry: FileEntry }) {
	const isDark = useIsDark();
	return (
		<HStack spacing={12} modifiers={[padding({ vertical: 2 }), accessibilityElement('combine')]}>
			<RowIcon
				systemImage={entry.isDirectory ? 'folder.fill' : 'doc.fill'}
				tint={
					entry.isDirectory ? undefined : withOpacity(secondaryHex[isDark ? 'dark' : 'light'], 0.6)
				}
				size={30}
			/>
			<VStack alignment="leading" spacing={4}>
				<Text
					modifiers={[
						font({ textStyle: 'subheadline', weight: 'medium' }),
						foregroundStyle('primary'),
						lineLimit(1)
					]}
				>
					{entry.name}
				</Text>
				<HStack
					spacing={6}
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						lineLimit(1)
					]}
				>
					<Text>{entry.isDirectory ? 'Folder' : byteString(entry.size)}</Text>
					<Text>•</Text>
					<Text>{relativeNamed(entry.modTime)}</Text>
					{entry.isSymlink ? (
						<>
							<Text>•</Text>
							<Text>Symlink</Text>
						</>
					) : null}
				</HStack>
			</VStack>
		</HStack>
	);
}

function entryKey(entry: FileEntry) {
	return entry.path;
}

function VolumeBrowserLink({ model, entry }: { model: VolumeBrowserModel; entry: FileEntry }) {
	if (entry.isDirectory) {
		return (
			<Button onPress={() => model.openDirectory(entry)} modifiers={[buttonStyle('plain')]}>
				<VolumeBrowserRow entry={entry} />
			</Button>
		);
	}
	return (
		<Button onPress={() => model.openFile(entry)} modifiers={[buttonStyle('plain')]}>
			<HStack modifiers={[contentShape(shapes.rectangle())]}>
				<VolumeBrowserRow entry={entry} />
				<Spacer />
				<DisclosureChevron />
			</HStack>
		</Button>
	);
}

function promptForPath(model: VolumeBrowserModel) {
	Alert.prompt(
		'Go to Path',
		'Enter a path inside this volume.',
		[
			{ text: 'Cancel', style: 'cancel' },
			{ text: 'Go', onPress: (value?: string) => model.applyPathInput(value ?? '') }
		],
		'plain-text',
		model.currentPath
	);
}

export function VolumeBrowserScreen() {
	const { name = '', envID = '0' } = useLocalSearchParams<{ name?: string; envID?: string }>();
	const model = useVolumeBrowser(envID, name);
	const icon = useToolbarIcons(['ellipsis.circle']);

	let content;
	if (model.isLoading && model.entries.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading files…" />
			</VStack>
		);
	} else if (model.errorMessage !== undefined && model.entries.length === 0) {
		content = (
			<ContentUnavailableView
				title="Couldn't Load Folder"
				systemImage="exclamationmark.triangle"
				description={model.errorMessage}
			/>
		);
	} else if (model.displayedEntries.length === 0) {
		content =
			model.searchText === '' ? (
				<ContentUnavailableView title="Empty Folder" systemImage="folder" />
			) : (
				<ContentUnavailableView
					title={`No Results for “${model.searchText}”`}
					systemImage="magnifyingglass"
					description="Check the spelling or try a new search."
				/>
			);
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped')]}>
				{model.errorMessage !== undefined ? (
					<Section>
						<Label
							title={model.errorMessage}
							systemImage="exclamationmark.triangle"
							modifiers={[foregroundStyle(systemColors.orange)]}
						/>
					</Section>
				) : null}
				<List.ForEach data={model.displayedEntries} keyExtractor={entryKey} estimatedItemSize={44}>
					{({ item }) => <VolumeBrowserLink model={model} entry={item} />}
				</List.ForEach>
			</List>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: model.title,
					headerLargeTitleEnabled: false,
					headerTransparent: false,
					headerShadowVisible: false,
					headerSearchBarOptions: {
						placeholder: 'Search folder',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			<AppToolbar>
				<Stack.Toolbar.Menu icon={icon('ellipsis.circle')} accessibilityLabel="More options">
					{model.canManageFiles ? (
						<Stack.Toolbar.MenuAction icon="doc.text" onPress={model.openWorkspace}>
							Manage files
						</Stack.Toolbar.MenuAction>
					) : null}
					<Stack.Toolbar.MenuAction
						icon="point.topleft.down.curvedto.point.bottomright.up"
						onPress={() => promptForPath(model)}
					>
						Go to Path
					</Stack.Toolbar.MenuAction>
					<Stack.Toolbar.MenuAction icon="arrow.clockwise" onPress={() => void model.loadEntries()}>
						Refresh
					</Stack.Toolbar.MenuAction>
				</Stack.Toolbar.Menu>
			</AppToolbar>
			<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
				<BreadcrumbBar model={model} />
				<Host style={{ flex: 1 }}>{content}</Host>
			</View>
		</>
	);
}

export function VolumeFileDetailScreen() {
	const {
		name = '',
		envID = '0',
		path = ''
	} = useLocalSearchParams<{ name?: string; envID?: string; path?: string }>();
	const entry = volumeCache.fileEntry(envID, name, path);
	const title = entry?.name ?? path.split('/').pop() ?? path;
	return (
		<>
			<Stack.Screen options={{ title, headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<List modifiers={[listStyle('insetGrouped')]}>
					{entry ? (
						<Section>
							<LabeledContent label="Path">
								<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
									{entry.path}
								</Text>
							</LabeledContent>
							<LabeledContent label="Size">
								<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
									{byteString(entry.size)}
								</Text>
							</LabeledContent>
							<LabeledContent label="Modified">
								<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
									{formattedISO8601(entry.modTime, 'abbreviated', 'standard')}
								</Text>
							</LabeledContent>
							<LabeledContent label="Mode">
								<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
									{entry.mode}
								</Text>
							</LabeledContent>
							<LabeledContent label="Symlink">
								<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
									{entry.isSymlink ? 'Yes' : 'No'}
								</Text>
							</LabeledContent>
							{entry.linkTarget ? (
								<LabeledContent label="Link Target">
									<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
										{entry.linkTarget}
									</Text>
								</LabeledContent>
							) : null}
						</Section>
					) : (
						<Section>
							<LabeledContent label="Path">
								<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
									{path}
								</Text>
							</LabeledContent>
						</Section>
					)}
				</List>
			</Host>
		</>
	);
}
