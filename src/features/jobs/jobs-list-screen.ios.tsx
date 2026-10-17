import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import {
	Button,
	ContentUnavailableView,
	ContextMenu,
	HStack,
	List,
	Section,
	SwipeActions,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import {
	buttonStyle,
	disabled,
	frame,
	listStyle,
	refreshable,
	tint,
	contentShape,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';

import { useEnvironmentRowColor } from '@/features/containers/hooks';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { EnvironmentLoadFailuresSection } from '@/ui/components/environment-label';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { AppToolbar } from '@/ui/components/toolbar';
import { DisclosureChevron } from '@/ui/settings-row';

import { capitalized, type JobItem } from './job-model';
import { JobRow } from './job-row';
import { useJobsList, type JobsListModel, type JobsListProps } from './use-jobs-list';

function JobLink({ model, job }: { model: JobsListModel; job: JobItem }) {
	const environmentColor = useEnvironmentRowColor(job.environmentID, job.environmentName);
	const isRunning = model.isRunning(job);
	const runDisabled = !model.canRun(job);
	return (
		<SwipeActions>
			<ContextMenu>
				<ContextMenu.Trigger>
					<Button
						onPress={() => model.openDetail(job)}
						modifiers={[buttonStyle('plain'), contentShape(shapes.rectangle())]}
					>
						<HStack>
							<JobRow
								job={job.value}
								isRunning={isRunning}
								environmentName={job.environmentName}
								environmentColor={environmentColor}
							/>
							<DisclosureChevron />
						</HStack>
					</Button>
				</ContextMenu.Trigger>
				<ContextMenu.Items>
					<Button
						label="Run Job"
						systemImage="play.fill"
						onPress={() => model.run(job)}
						modifiers={[disabled(runDisabled)]}
					/>
					<Button
						label="Copy Job Name"
						systemImage="doc.on.doc"
						onPress={() => model.copyName(job)}
					/>
					{job.value.schedule !== '' ? (
						<Button
							label="Copy Schedule"
							systemImage="clock"
							onPress={() => model.copySchedule(job)}
						/>
					) : null}
				</ContextMenu.Items>
			</ContextMenu>
			<SwipeActions.Actions edge="leading" allowsFullSwipe>
				<Button
					label="Run"
					systemImage="play.fill"
					onPress={() => model.run(job)}
					modifiers={[tint(systemColors.blue), disabled(runDisabled)]}
				/>
			</SwipeActions.Actions>
			<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
				<Button
					label="Copy"
					systemImage="doc.on.doc"
					onPress={() => model.copyName(job)}
					modifiers={[tint(systemColors.gray)]}
				/>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

export function JobsListView(props: JobsListProps) {
	const model = useJobsList(props);
	const { snapshot, jobs, groups } = model;
	const firstCategory = groups[0]?.category;

	let content;
	if (snapshot.isLoading && jobs.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading jobs…" />
			</VStack>
		);
	} else if (snapshot.errorMessage !== undefined && jobs.length === 0) {
		content = (
			<UnavailableView
				title="Couldn't Load Jobs"
				systemImage="exclamationmark.triangle"
				description={snapshot.errorMessage}
				actions={[{ title: 'Retry', onPress: () => void model.load() }]}
			/>
		);
	} else if (jobs.length === 0) {
		content = <ContentUnavailableView title="No Jobs" systemImage="play.square.stack" />;
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(model.load)]}>
				<EnvironmentLoadFailuresSection
					failures={snapshot.failedEnvironments.map((failure) => ({
						...failure,
						id: failure.environment.id
					}))}
					retry={() => void model.load()}
				/>
				{groups.map((group) => (
					<Section
						key={group.category}
						header={
							group.category === firstCategory ? (
								<ResourceCountSectionHeader
									title={capitalized(group.category)}
									loadedCount={model.filteredJobCount}
								/>
							) : (
								<Text>{capitalized(group.category)}</Text>
							)
						}
					>
						{group.jobs.map((job) => (
							<JobLink key={job.id} model={model} job={job} />
						))}
					</Section>
				))}
			</List>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Jobs',
					headerSearchBarOptions: {
						placeholder: 'Search jobs',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			<AppToolbar>
				<Stack.Toolbar.Button
					icon="arrow.clockwise"
					accessibilityLabel="Refresh"
					disabled={snapshot.isLoading}
					onPress={() => void model.load()}
				/>
			</AppToolbar>
			<Host style={{ flex: 1 }}>{content}</Host>
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
