import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { CenteredMessage } from '@/features/containers/android-material';
import { useEnvironmentRowColor } from '@/features/containers/hooks';
import { LongPressMenu, type RowMenuItem } from '@/features/containers/long-press-menu';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { EnvironmentLoadFailuresSection } from '@/ui/components/environment-label';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { MaterialListGroup, MaterialSectionHeader } from '@/ui/material/list';

import { capitalized, type JobItem } from './job-model';
import { JobRow } from './job-row';
import { useJobsList, type JobsListModel, type JobsListProps } from './use-jobs-list';

function rowMenuItems(model: JobsListModel, job: JobItem): RowMenuItem[] {
	const items: RowMenuItem[] = [
		{ id: 'run', title: 'Run Job', disabled: !model.canRun(job), onPress: () => model.run(job) },
		{ id: 'copy-name', title: 'Copy Job Name', onPress: () => model.copyName(job) }
	];
	if (job.value.schedule !== '') {
		items.push({
			id: 'copy-schedule',
			title: 'Copy Schedule',
			onPress: () => model.copySchedule(job)
		});
	}
	return items;
}

function JobListRow({ model, job }: { model: JobsListModel; job: JobItem }) {
	const environmentColor = useEnvironmentRowColor(job.environmentID, job.environmentName);
	return (
		<LongPressMenu
			items={rowMenuItems(model, job)}
			title={job.value.name}
			onPress={() => model.openDetail(job)}
			style={{ paddingHorizontal: 16, paddingVertical: 12 }}
		>
			<JobRow
				job={job.value}
				isRunning={model.isRunning(job)}
				environmentName={job.environmentName}
				environmentColor={environmentColor}
			/>
		</LongPressMenu>
	);
}

export function JobsListView(props: JobsListProps) {
	const model = useJobsList(props);
	const { snapshot, jobs, groups } = model;
	const [refreshing, setRefreshing] = useState(false);
	const firstCategory = groups[0]?.category;

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await model.load();
		} finally {
			setRefreshing(false);
		}
	};

	let content;
	if (snapshot.isLoading && jobs.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading jobs…" />
			</View>
		);
	} else if (snapshot.errorMessage !== undefined && jobs.length === 0) {
		content = (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load Jobs"
				message={snapshot.errorMessage}
				action={{ title: 'Retry', onPress: () => void model.load() }}
			/>
		);
	} else if (jobs.length === 0) {
		content = <CenteredMessage icon="play.square.stack" title="No Jobs" message="" />;
	} else {
		content = (
			<View>
				{snapshot.failedEnvironments.length > 0 ? <View style={{ height: 12 }} /> : null}
				<EnvironmentLoadFailuresSection
					failures={snapshot.failedEnvironments.map((failure) => ({
						...failure,
						id: failure.environment.id
					}))}
					retry={() => void model.load()}
				/>
				{groups.map((group) => (
					<View key={group.category}>
						{group.category === firstCategory ? (
							<ResourceCountSectionHeader
								title={capitalized(group.category)}
								loadedCount={model.filteredJobCount}
							/>
						) : (
							<MaterialSectionHeader title={capitalized(group.category)} />
						)}
						<MaterialListGroup>
							{group.jobs.map((job) => (
								<JobListRow key={job.id} model={model} job={job} />
							))}
						</MaterialListGroup>
					</View>
				))}
			</View>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Jobs',
					headerSearchBarOptions: {
						placeholder: 'Search jobs',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'refresh',
						icon: 'arrow.clockwise',
						label: 'Refresh',
						disabled: snapshot.isLoading,
						onPress: () => void model.load()
					}
				]}
			/>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
				keyboardShouldPersistTaps="handled"
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => void onRefresh()}
						colors={[systemColors.blue]}
					/>
				}
			>
				{content}
			</ScrollView>
		</>
	);
}

export function JobsListScreen() {
	const { envID = '0', all } = useLocalSearchParams<{ envID?: string; all?: string }>();
	return (
		<JobsListView
			key={`${envID}|${all ?? ''}`}
			environmentID={envID}
			allEnvironments={all === '1'}
		/>
	);
}
