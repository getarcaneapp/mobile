import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { CenteredMessage } from '@/features/containers/android-material';
import { useEnvironmentRowColor } from '@/features/containers/hooks';
import { LongPressMenu, type RowMenuItem } from '@/features/containers/long-press-menu';
import { withCleanup } from '@/core/with-cleanup';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import {
	GroupedFlashList,
	groupPosition,
	type GroupedListEntry
} from '@/ui/components/grouped-flash-list';
import { EnvironmentLoadFailuresSection } from '@/ui/components/environment-label';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { MaterialSectionHeader } from '@/ui/material/list';

import { capitalized, type JobItem } from './job-model';
import { JobRow } from './job-row';
import { useJobsList, type JobsListModel, type JobsListProps } from './use-jobs-list';

const listRowStyle = { paddingHorizontal: 16, paddingVertical: 12 };
const failuresSpacerStyle = { height: 12 };

type JobEntry = GroupedListEntry &
	({ type: 'header'; category: string; isFirst: boolean } | { type: 'item'; job: JobItem });

function jobEntries(groups: JobsListModel['groups']) {
	const entries: JobEntry[] = [];
	groups.forEach((group, index) => {
		entries.push({
			type: 'header',
			key: `header:${group.category}`,
			category: group.category,
			isFirst: index === 0
		});
		group.jobs.forEach((job, jobIndex) => {
			entries.push({
				type: 'item',
				key: `job:${group.category}:${job.id}`,
				job,
				grouped: groupPosition(jobIndex, group.jobs.length)
			});
		});
	});
	return entries;
}

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
			style={listRowStyle}
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

	const onRefresh = async () => {
		setRefreshing(true);
		await withCleanup(model.load, () => setRefreshing(false));
	};

	const refreshControl = (
		<RefreshControl
			refreshing={refreshing}
			onRefresh={() => void onRefresh()}
			colors={[systemColors.blue]}
		/>
	);

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
			{content === undefined ? (
				<GroupedFlashList
					data={jobEntries(groups)}
					renderEntry={(entry) => {
						if (entry.type === 'item') return <JobListRow model={model} job={entry.job} />;
						return entry.isFirst ? (
							<ResourceCountSectionHeader
								title={capitalized(entry.category)}
								loadedCount={model.filteredJobCount}
							/>
						) : (
							<MaterialSectionHeader title={capitalized(entry.category)} />
						);
					}}
					header={
						<>
							{snapshot.failedEnvironments.length > 0 ? <View style={failuresSpacerStyle} /> : null}
							<EnvironmentLoadFailuresSection
								failures={snapshot.failedEnvironments.map((failure) => ({
									...failure,
									id: failure.environment.id
								}))}
								retry={() => void model.load()}
							/>
						</>
					}
					refreshControl={refreshControl}
				/>
			) : (
				<ScrollView
					contentInsetAdjustmentBehavior="automatic"
					style={{ backgroundColor: colors.systemGroupedBackground }}
					contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
					keyboardShouldPersistTaps="handled"
					refreshControl={refreshControl}
				>
					{content}
				</ScrollView>
			)}
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
