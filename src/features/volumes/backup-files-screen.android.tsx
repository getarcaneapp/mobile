import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { m3 } from '@/ui/components/material-colors';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import {
	CenteredMessage,
	M3Section,
	SwitchRow,
	TextButtonRow,
	ValueRow
} from '@/features/containers/android-material';
import { AndroidToolbar } from '@/features/containers/android-toolbar';

import { TextRow } from './android-rows';
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
							disabled: !model.canSubmitRestore,
							onPress: model.requestRestore
						}
					]}
				/>
			) : null}
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
			>
				{model.busy && model.entries.length === 0 ? (
					<View style={{ padding: 16, alignItems: 'center' }}>
						<ArcaneLoadingView label="Loading…" />
					</View>
				) : null}
				{model.errorMessage !== undefined ? (
					<M3Section>
						<TextRow text={model.errorMessage} color={systemColors.red} />
						<TextButtonRow title="Retry" onPress={model.retry} />
					</M3Section>
				) : null}
				<M3Section>
					<ValueRow title="Folder" value={model.folderTitle} />
					{model.path !== '' ? (
						<TextButtonRow title="Parent folder" onPress={model.goToParent} />
					) : null}
					{model.showsToggle ? (
						<SwitchRow
							title="Restore all matching files"
							value={model.selectAll}
							onValueChange={model.setSelectAll}
						/>
					) : null}
				</M3Section>
				{model.entries.length > 0 ? (
					<M3Section>
						{model.entries.map((entry) => {
							const isSelected = model.selected.includes(entry.path);
							return (
								<View
									key={entry.path}
									style={{
										flexDirection: 'row',
										alignItems: 'center',
										minHeight: 52,
										paddingHorizontal: 8
									}}
								>
									{model.showsSelection ? (
										<Pressable
											onPress={() => model.toggleSelected(entry)}
											accessibilityRole="checkbox"
											accessibilityState={{ checked: isSelected }}
											accessibilityLabel={`Select ${entry.name}`}
											android_ripple={{
												color: colors.separator as string,
												borderless: true,
												radius: 20
											}}
											style={{
												width: 40,
												height: 40,
												alignItems: 'center',
												justifyContent: 'center'
											}}
										>
											<Icon
												name={isSelected ? 'checkmark.circle.fill' : 'circle'}
												size={22}
												color={m3.primary}
											/>
										</Pressable>
									) : null}
									<Pressable
										onPress={entry.isDirectory ? () => model.openDirectory(entry) : undefined}
										disabled={!entry.isDirectory}
										android_ripple={{ color: colors.separator as string }}
										style={{
											flex: 1,
											flexDirection: 'row',
											alignItems: 'center',
											gap: 16,
											paddingHorizontal: 8,
											paddingVertical: 12
										}}
									>
										<Icon
											name={entry.isDirectory ? 'folder' : 'doc'}
											size={22}
											color={entry.isDirectory ? m3.primary : colors.secondaryLabel}
										/>
										<Text
											style={[
												m3Type.bodyLarge,
												{ color: entry.isDirectory ? m3.primary : colors.label, flex: 1 }
											]}
										>
											{entry.name}
										</Text>
									</Pressable>
								</View>
							);
						})}
					</M3Section>
				) : null}
				{model.entries.length === 0 && !model.busy && model.errorMessage === undefined ? (
					<CenteredMessage icon="folder" title="No Files" message="Try another folder or search." />
				) : null}
				<PaginatedListFooter
					key={model.entries.length}
					hasMore={model.hasMore}
					loadMoreError={model.loadMoreError}
					onRetry={model.loadMore}
					onLoadMore={model.loadMore}
				/>
			</ScrollView>
		</>
	);
}
