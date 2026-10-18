import { Stack, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	View,
	type ScrollViewInstance
} from 'react-native';

import { formattedISO8601 } from '@/core/date-formatting';
import type { FileEntry } from '@/sdk/models/volume/Browse';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { GroupedFlashList, groupPosition } from '@/ui/components/grouped-flash-list';
import { m3 } from '@/ui/components/material-colors';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { CenteredMessage, M3Section, ValueRow } from '@/features/containers/android-material';
import { AndroidToolbar, type AndroidMenuItem } from '@/features/containers/android-toolbar';

import { TextPromptDialog } from './android-dialogs';
import { TextRow } from './android-rows';
import { useVolumeBrowser, type VolumeBrowserModel } from './use-volume-browser';
import { byteString, relativeNamed } from './volume-model';
import { volumeCache } from './volume-routes';

function Chip({
	title,
	isCurrent,
	onPress
}: {
	title: string;
	isCurrent: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={title === '/' ? 'Root folder' : title}
			android_ripple={{ color: colors.separator as string, borderless: false }}
			style={{
				height: 32,
				paddingHorizontal: 12,
				borderRadius: 8,
				justifyContent: 'center',
				backgroundColor: isCurrent ? m3.secondaryContainer : 'transparent',
				borderWidth: isCurrent ? 0 : 1,
				borderColor: m3.outline
			}}
		>
			<Text
				numberOfLines={1}
				style={[m3Type.labelLarge, { color: isCurrent ? m3.onSecondaryContainer : colors.label }]}
			>
				{title}
			</Text>
		</Pressable>
	);
}

function BreadcrumbBar({ model }: { model: VolumeBrowserModel }) {
	const scroll = useRef<ScrollViewInstance>(null);
	useEffect(() => {
		const timer = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
		return () => clearTimeout(timer);
	}, [model.currentPath]);
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 4,
				paddingHorizontal: 8,
				backgroundColor: colors.systemGroupedBackground
			}}
		>
			{model.segments.length > 0 ? (
				<Pressable
					onPress={model.goUp}
					accessibilityRole="button"
					accessibilityLabel="Up one level"
					android_ripple={{ color: colors.separator as string, borderless: true, radius: 20 }}
					style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
				>
					<Icon name="arrow.turn.left.up" size={22} color={m3.primary} />
				</Pressable>
			) : null}
			<ScrollView
				ref={scroll}
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={{ gap: 8, paddingHorizontal: 8, paddingVertical: 8 }}
			>
				<Chip title="/" isCurrent={model.segments.length === 0} onPress={model.goToRoot} />
				{model.segments.map((segment, index) => (
					<Chip
						key={`segment-${index}`}
						title={segment}
						isCurrent={index === model.segments.length - 1}
						onPress={() => model.goToSegment(index)}
					/>
				))}
			</ScrollView>
		</View>
	);
}

const browserRowStyle = {
	flexDirection: 'row' as const,
	alignItems: 'center' as const,
	gap: 12,
	paddingHorizontal: 16,
	paddingVertical: 10
};
const browserBodyStyle = { flex: 1, gap: 4 };
const sectionSpacerStyle = { height: 12 };
const scrollStyle = { flex: 1 };
const scrollContentStyle = { flexGrow: 1, paddingBottom: 24 };

function BrowserRow({ entry, onPress }: { entry: FileEntry; onPress: () => void }) {
	const meta = [
		entry.isDirectory ? 'Folder' : byteString(entry.size),
		relativeNamed(entry.modTime),
		...(entry.isSymlink ? ['Symlink'] : [])
	];
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			android_ripple={{ color: colors.separator as string }}
			style={browserRowStyle}
		>
			<RowIcon
				systemImage={entry.isDirectory ? 'folder.fill' : 'doc.fill'}
				tint={entry.isDirectory ? undefined : (colors.secondaryLabel as string)}
				size={30}
			/>
			<View style={browserBodyStyle}>
				<Text numberOfLines={1} style={[m3Type.titleSmall, { color: colors.label }]}>
					{entry.name}
				</Text>
				<Text numberOfLines={1} style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
					{meta.join(' • ')}
				</Text>
			</View>
			{entry.isDirectory ? null : (
				<Icon name="chevron.right" size={16} color={colors.secondaryLabel} />
			)}
		</Pressable>
	);
}

export function VolumeBrowserScreen() {
	const { name = '', envID = '0' } = useLocalSearchParams<{ name?: string; envID?: string }>();
	const model = useVolumeBrowser(envID, name);
	const [showPathDialog, setShowPathDialog] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	usePreventRemove(model.segments.length > 0, ({ data }) => {
		if (data.action.type === 'GO_BACK' || data.action.type === 'POP') model.goUp();
		else model.goToRoot();
	});

	const menu: AndroidMenuItem[] = [];
	if (model.canManageFiles)
		menu.push({ id: 'manage', title: 'Manage files', onPress: model.openWorkspace });
	menu.push(
		{ id: 'path', title: 'Go to Path', onPress: () => setShowPathDialog(true) },
		{ id: 'refresh', title: 'Refresh', onPress: () => void model.loadEntries() }
	);

	let content;
	if (model.isLoading && model.entries.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading files…" />
			</View>
		);
	} else if (model.errorMessage !== undefined && model.entries.length === 0) {
		content = (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load Folder"
				message={model.errorMessage}
			/>
		);
	} else if (model.displayedEntries.length === 0) {
		content =
			model.searchText === '' ? (
				<CenteredMessage icon="folder" title="Empty Folder" message="" />
			) : (
				<CenteredMessage
					icon="magnifyingglass"
					title={`No Results for “${model.searchText}”`}
					message="Check the spelling or try a new search."
				/>
			);
	}

	const refreshControl = (
		<RefreshControl
			refreshing={refreshing}
			onRefresh={() => {
				setRefreshing(true);
				void model.loadEntries().finally(() => setRefreshing(false));
			}}
		/>
	);
	return (
		<>
			<Stack.Screen
				options={{
					title: model.title,
					headerSearchBarOptions: {
						placeholder: 'Search folder',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			<AndroidToolbar
				items={[
					{
						kind: 'menu',
						id: 'options',
						icon: 'ellipsis.circle',
						label: 'More options',
						items: menu
					}
				]}
			/>
			<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
				<BreadcrumbBar model={model} />
				{content === undefined ? (
					<GroupedFlashList
						data={model.displayedEntries.map((entry, index) => ({
							key: entry.path,
							type: 'item',
							entry,
							grouped: groupPosition(index, model.displayedEntries.length)
						}))}
						renderEntry={({ entry }) => (
							<BrowserRow
								entry={entry}
								onPress={() =>
									entry.isDirectory ? model.openDirectory(entry) : model.openFile(entry)
								}
							/>
						)}
						header={
							<>
								{model.errorMessage !== undefined ? (
									<M3Section>
										<TextRow text={model.errorMessage} color={systemColors.orange} />
									</M3Section>
								) : null}
								<View style={sectionSpacerStyle} />
							</>
						}
						refreshControl={refreshControl}
					/>
				) : (
					<ScrollView
						style={scrollStyle}
						contentContainerStyle={scrollContentStyle}
						keyboardShouldPersistTaps="handled"
						refreshControl={refreshControl}
					>
						{content}
					</ScrollView>
				)}
			</View>
			<TextPromptDialog
				visible={showPathDialog}
				title="Go to Path"
				message="Enter a path inside this volume."
				placeholder="Path"
				initialValue={model.currentPath}
				confirmTitle="Go"
				onConfirm={(value) => {
					setShowPathDialog(false);
					model.applyPathInput(value);
				}}
				onCancel={() => setShowPathDialog(false)}
			/>
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
			<Stack.Screen options={{ title }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				<M3Section>
					<ValueRow title="Path" value={entry?.path ?? path} />
					{entry ? (
						<>
							<ValueRow title="Size" value={byteString(entry.size)} />
							<ValueRow
								title="Modified"
								value={formattedISO8601(entry.modTime, 'abbreviated', 'standard')}
							/>
							<ValueRow title="Mode" value={entry.mode} />
							<ValueRow title="Symlink" value={entry.isSymlink ? 'Yes' : 'No'} />
							{entry.linkTarget ? <ValueRow title="Link Target" value={entry.linkTarget} /> : null}
						</>
					) : null}
				</M3Section>
			</ScrollView>
		</>
	);
}
