import { Host } from '@/ui/host';
import {
	Button,
	ConfirmationDialog,
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
import { accessibilityLabel, buttonStyle, listStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';

import { useAccentColor } from '@/theme/accent';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { PaginatedListFooter } from '@/ui/components/paginated-list';

import { useFilesParam } from './backup-routes';
import { ErrorRetryRows } from './backup-rows';
import { useBackupFiles } from './use-backup-files';

export function BackupFilesScreen() {
	const model = useBackupFiles(useFilesParam());
	const accent = useAccentColor();
	const { entries, busy, errorMessage } = model;
	const showsSelection = model.canRestore && !model.selectAll;

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Backup Files',
					headerSearchBarOptions: {
						onChangeText: (event) => model.setSearch(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearch('')
					}
				}}
			/>
			{model.canRestore ? (
				<AppToolbar placement="right" tintColor={accent}>
					<Stack.Toolbar.Button
						disabled={model.restoreDisabled}
						onPress={() => model.setConfirm(true)}
					>
						Restore
					</Stack.Toolbar.Button>
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>
				<ConfirmationDialog
					title={model.confirmTitle}
					titleVisibility="visible"
					isPresented={model.confirm}
					onIsPresentedChange={model.setConfirm}
				>
					<ConfirmationDialog.Trigger>
						<List modifiers={[listStyle('insetGrouped')]}>
							{busy && entries.length === 0 ? (
								<ArcaneLoadingViewSwiftUI label="Loading…" fillsWidth />
							) : null}
							<ErrorRetryRows message={errorMessage} onRetry={() => void model.load()} />
							<Section>
								<LabeledContent label="Folder">
									<Text>{model.folderTitle}</Text>
								</LabeledContent>
								{model.path !== '' ? (
									<Button label="Parent folder" onPress={model.openParent} />
								) : null}
								{model.canRestore && !model.legacyBrowser ? (
									<Toggle
										label="Restore all matching files"
										isOn={model.selectAll}
										onIsOnChange={model.setSelectAll}
									/>
								) : null}
							</Section>
							{entries.map((entry) => (
								<HStack key={entry.path}>
									{showsSelection ? (
										<Button
											onPress={() => model.toggleSelected(entry.path)}
											modifiers={[
												buttonStyle('borderless'),
												accessibilityLabel(`Select ${entry.name}`)
											]}
										>
											<Image
												systemName={
													model.selected.has(entry.path) ? 'checkmark.circle.fill' : 'circle'
												}
											/>
										</Button>
									) : null}
									{entry.isDirectory ? (
										<Button onPress={() => model.openFolder(entry.path)}>
											<Label title={entry.name} systemImage="folder" />
										</Button>
									) : (
										<Label title={entry.name} systemImage="doc" />
									)}
								</HStack>
							))}
							{entries.length === 0 && !busy && errorMessage === undefined ? (
								<ContentUnavailableView
									title="No Files"
									systemImage="folder"
									description="Try another folder or search."
								/>
							) : null}
							<PaginatedListFooter
								key={entries.length}
								hasMore={model.hasMore}
								loadMoreError={model.loadMoreError}
								onRetry={model.loadMore}
								onLoadMore={model.loadMore}
							/>
						</List>
					</ConfirmationDialog.Trigger>
					<ConfirmationDialog.Actions>
						<Button label={model.confirmAction} role="destructive" onPress={model.restore} />
					</ConfirmationDialog.Actions>
					<ConfirmationDialog.Message>
						<Text>{model.confirmMessage}</Text>
					</ConfirmationDialog.Message>
				</ConfirmationDialog>
			</Host>
		</>
	);
}
