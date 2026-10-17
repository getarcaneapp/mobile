import { Host } from '@/ui/host';
import {
	Button,
	ContentUnavailableView,
	HStack,
	Label,
	LabeledContent,
	List,
	Section,
	Text,
	Toggle
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityLabel,
	buttonStyle,
	foregroundStyle,
	frame,
	listStyle
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';

import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { AppToolbar } from '@/ui/components/toolbar';

import { useBackupFiles } from './use-backup-files';

export function BackupFilesScreen() {
	const {
		name = '',
		envID = '0',
		backupID = '',
		canRestore
	} = useLocalSearchParams<{
		name?: string;
		envID?: string;
		backupID?: string;
		canRestore?: string;
	}>();
	const model = useBackupFiles({
		backupID,
		environmentID: envID,
		volumeName: name,
		canRestore: canRestore === '1'
	});

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Backup Files',
					headerLargeTitleEnabled: false,
					headerSearchBarOptions: {
						onChangeText: (event) => model.setSearch(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearch('')
					}
				}}
			/>
			{model.canRestore ? (
				<AppToolbar>
					<Stack.Toolbar.Button disabled={!model.canSubmitRestore} onPress={model.requestRestore}>
						Restore
					</Stack.Toolbar.Button>
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>
				<List modifiers={[listStyle('insetGrouped')]}>
					{model.busy && model.entries.length === 0 ? (
						<HStack modifiers={[frame({ maxWidth: Infinity })]}>
							<ArcaneLoadingViewSwiftUI label="Loading…" fillsWidth />
						</HStack>
					) : null}
					{model.errorMessage !== undefined ? (
						<>
							<Text modifiers={[foregroundStyle(systemColors.red)]}>{model.errorMessage}</Text>
							<Button label="Retry" onPress={model.retry} />
						</>
					) : null}
					<Section>
						<LabeledContent label="Folder">
							<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
								{model.folderTitle}
							</Text>
						</LabeledContent>
						{model.path !== '' ? <Button label="Parent folder" onPress={model.goToParent} /> : null}
						{model.showsToggle ? (
							<Toggle
								label="Restore all matching files"
								isOn={model.selectAll}
								onIsOnChange={model.setSelectAll}
							/>
						) : null}
					</Section>
					{model.entries.map((entry) => (
						<HStack key={entry.path}>
							{model.showsSelection ? (
								<Button
									onPress={() => model.toggleSelected(entry)}
									modifiers={[
										buttonStyle('borderless'),
										accessibilityLabel(`Select ${entry.name}`)
									]}
								>
									<Image
										systemName={
											model.selected.includes(entry.path) ? 'checkmark.circle.fill' : 'circle'
										}
									/>
								</Button>
							) : null}
							{entry.isDirectory ? (
								<Button onPress={() => model.openDirectory(entry)}>
									<Label title={entry.name} systemImage="folder" />
								</Button>
							) : (
								<Label title={entry.name} systemImage="doc" />
							)}
						</HStack>
					))}
					{model.entries.length === 0 && !model.busy && model.errorMessage === undefined ? (
						<ContentUnavailableView
							title="No Files"
							systemImage="folder"
							description="Try another folder or search."
						/>
					) : null}
					<PaginatedListFooter
						key={model.entries.length}
						hasMore={model.hasMore}
						loadMoreError={model.loadMoreError}
						onRetry={model.loadMore}
						onLoadMore={model.loadMore}
					/>
				</List>
			</Host>
		</>
	);
}
