import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { RoleAssignment, RoleAssignmentSource } from '@/sdk/models/role/RoleAssignment';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { m3 } from '@/ui/components/material-colors';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup, MaterialSectionHeader } from '@/ui/material/list';

import { ActionErrorAlert } from '../shared/action-error-alert';
import { CenteredMessage } from '../shared/android-material';
import { AndroidToolbar } from '../shared/android-toolbar';
import { LongPressMenu } from '../shared/long-press-menu';

import { isManualAssignment, roleDisplayName, roleIconColor, roleSystemImage } from './rbac-models';
import { useUserRoleAssignments, type UserRoleAssignmentsModel } from './use-user-role-assignments';

const rowStyle = {
	flexDirection: 'row',
	alignItems: 'center',
	gap: 16,
	minHeight: 64,
	paddingHorizontal: 16,
	paddingVertical: 8
} as const;

function AssignmentItem({
	model,
	assignment
}: {
	model: UserRoleAssignmentsModel;
	assignment: RoleAssignment;
}) {
	const role = model.roleFor(assignment);
	const fromSSO = RoleAssignment.sourceKind(assignment) === RoleAssignmentSource.oidc;
	const name = role ? roleDisplayName(role) : assignment.roleId;
	const content = (
		<>
			<RowIcon
				systemImage={role ? roleSystemImage(role) : 'person.crop.rectangle.fill'}
				tint={role ? roleIconColor(role) : systemColors.gray}
				size={30}
			/>
			<View style={{ flex: 1, gap: 2 }}>
				<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{name}</Text>
				{fromSSO ? (
					<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>From SSO</Text>
				) : null}
			</View>
			{fromSSO ? <Icon name="lock.fill" size={16} color={colors.tertiaryLabel} /> : null}
		</>
	);
	if (!isManualAssignment(assignment)) {
		return (
			<View style={rowStyle} accessible accessibilityLabel={fromSSO ? `${name}, from SSO` : name}>
				{content}
			</View>
		);
	}
	return (
		<LongPressMenu
			title={name}
			accessibilityLabel={name}
			items={[
				{
					id: 'remove',
					title: 'Remove',
					destructive: true,
					onPress: () => model.requestRemove(assignment)
				}
			]}
			style={rowStyle}
		>
			{content}
		</LongPressMenu>
	);
}

export function UserRoleAssignmentsScreen() {
	const model = useUserRoleAssignments();
	const [refreshing, setRefreshing] = useState(false);

	let content;
	if (model.isLoading && model.assignments.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading assignments…" />
			</View>
		);
	} else if (model.errorMessage !== undefined && model.assignments.length === 0) {
		content = (
			<CenteredMessage icon="exclamationmark.triangle" title="Error" message={model.errorMessage} />
		);
	} else if (model.assignments.length === 0) {
		content = (
			<CenteredMessage
				icon="person.crop.circle.badge.questionmark"
				title="No Role Assignments"
				message="This user has no roles assigned and cannot perform actions."
			/>
		);
	} else {
		content = model.sections.map((section) => (
			<View key={section.id}>
				<MaterialSectionHeader title={section.title} />
				<MaterialListGroup>
					{section.assignments.map((assignment, index) => (
						<View key={assignment.id}>
							{index > 0 ? (
								<View style={{ height: 0.5, marginLeft: 62, backgroundColor: colors.separator }} />
							) : null}
							<AssignmentItem model={model} assignment={assignment} />
						</View>
					))}
				</MaterialListGroup>
			</View>
		));
	}

	return (
		<>
			<Stack.Screen options={{ title: 'Role Assignments' }} />
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'add',
						icon: 'plus',
						label: 'Add Role Assignment',
						disabled: !model.canAdd,
						onPress: model.openAdd
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						colors={[m3.primary as string]}
						onRefresh={() => {
							setRefreshing(true);
							void model.load().finally(() => setRefreshing(false));
						}}
					/>
				}
			>
				{content}
			</ScrollView>
			<ActionErrorAlert
				title="Couldn't Update Assignments"
				message={model.actionErrorMessage}
				onDismiss={model.dismissActionError}
			/>
		</>
	);
}
