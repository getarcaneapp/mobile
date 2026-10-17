import { Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { useDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { m3 } from '@/ui/components/material-colors';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { AndroidToolbar } from '../shared/android-toolbar';
import {
	CenteredMessage,
	M3Section,
	SwitchRow,
	TextButtonRow,
	ValueRow
} from '../shared/android-material';
import { AndroidErrorRetry } from './backup-android';
import { useFilesParam } from './backup-routes';
import { useBackupFiles } from './use-backup-files';

export function BackupFilesScreen() {
	const model = useBackupFiles(useFilesParam());
	const { entries, busy, errorMessage } = model;
	const showsSelection = model.canRestore && !model.selectAll;
	useDeleteConfirmation(model.confirm, model.setConfirm, {
		title: model.confirmTitle,
		message: model.confirmMessage,
		actions: [{ title: model.confirmAction, action: model.restore }],
		dismissOnConfirm: false
	});

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Backup Files',
					headerSearchBarOptions: {
						onChangeText: (event) => model.setSearch(event.nativeEvent.text),
						onClose: () => model.setSearch('')
					}
				}}
			/>
			{model.canRestore ? (
				<AndroidToolbar
					items={[
						{
							kind: 'button',
							id: 'restore',
							icon: 'arrow.counterclockwise',
							label: 'Restore',
							disabled: model.restoreDisabled,
							onPress: () => model.setConfirm(true)
						}
					]}
				/>
			) : null}
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 48 }}
			>
				{busy && entries.length === 0 ? (
					<View style={{ padding: 24, alignItems: 'center' }}>
						<ArcaneLoadingView label="Loading…" />
					</View>
				) : null}
				<AndroidErrorRetry message={errorMessage} onRetry={() => void model.load()} />
				<M3Section>
					<ValueRow title="Folder" value={model.folderTitle} />
					{model.path !== '' ? (
						<TextButtonRow title="Parent folder" onPress={model.openParent} />
					) : null}
					{model.canRestore && !model.legacyBrowser ? (
						<SwitchRow
							title="Restore all matching files"
							value={model.selectAll}
							onValueChange={model.setSelectAll}
						/>
					) : null}
				</M3Section>
				<View style={{ height: 12 }} />
				<MaterialListGroup>
					{entries.map((entry) => {
						const isSelected = model.selected.has(entry.path);
						return (
							<View
								key={entry.path}
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									minHeight: 56,
									paddingHorizontal: 8
								}}
							>
								{showsSelection ? (
									<Pressable
										onPress={() => model.toggleSelected(entry.path)}
										accessibilityRole="checkbox"
										accessibilityState={{ checked: isSelected }}
										accessibilityLabel={`Select ${entry.name}`}
										android_ripple={{
											color: colors.separator as string,
											borderless: true,
											radius: 20
										}}
										style={{
											width: 48,
											height: 48,
											alignItems: 'center',
											justifyContent: 'center'
										}}
									>
										<Icon
											name={isSelected ? 'checkmark.circle.fill' : 'circle'}
											size={24}
											color={isSelected ? m3.primary : colors.secondaryLabel}
										/>
									</Pressable>
								) : null}
								<Pressable
									onPress={entry.isDirectory ? () => model.openFolder(entry.path) : undefined}
									disabled={!entry.isDirectory}
									accessibilityRole={entry.isDirectory ? 'button' : undefined}
									android_ripple={{ color: colors.separator as string }}
									style={{
										flex: 1,
										flexDirection: 'row',
										alignItems: 'center',
										gap: 16,
										minHeight: 56,
										paddingHorizontal: 8
									}}
								>
									<Icon
										name={entry.isDirectory ? 'folder' : 'doc'}
										size={24}
										color={entry.isDirectory ? m3.primary : colors.secondaryLabel}
									/>
									<Text
										style={[
											m3Type.bodyLarge,
											{ color: entry.isDirectory ? m3.primary : colors.label, flex: 1 }
										]}
										numberOfLines={1}
									>
										{entry.name}
									</Text>
								</Pressable>
							</View>
						);
					})}
					<PaginatedListFooter
						key={entries.length}
						hasMore={model.hasMore}
						loadMoreError={model.loadMoreError}
						onRetry={model.loadMore}
						onLoadMore={model.loadMore}
					/>
				</MaterialListGroup>
				{entries.length === 0 && !busy && errorMessage === undefined ? (
					<CenteredMessage icon="folder" title="No Files" message="Try another folder or search." />
				) : null}
			</ScrollView>
		</>
	);
}
