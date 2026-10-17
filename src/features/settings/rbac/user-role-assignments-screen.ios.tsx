import { Host } from '@/ui/host';
import {
	Button,
	ContentUnavailableView,
	HStack,
	List,
	Section,
	Spacer,
	SwipeActions,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	font,
	foregroundStyle,
	frame,
	listStyle,
	refreshable,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';

import { RoleAssignment, RoleAssignmentSource } from '@/sdk/models/role/RoleAssignment';
import type { Role } from '@/sdk/models/role/Role';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { RowIcon } from '@/ui/components/row-icon';

import { ActionErrorAlert } from '../shared/action-error-alert';

import { isManualAssignment, roleDisplayName, roleIconColor, roleSystemImage } from './rbac-models';
import { useUserRoleAssignments, type UserRoleAssignmentsModel } from './use-user-role-assignments';

function AssignmentRow({
	assignment,
	role
}: {
	assignment: RoleAssignment;
	role: Role | undefined;
}) {
	const fromSSO = RoleAssignment.sourceKind(assignment) === RoleAssignmentSource.oidc;
	return (
		<HStack spacing={12}>
			<RowIcon
				systemImage={role ? roleSystemImage(role) : 'person.crop.rectangle.fill'}
				tint={role ? roleIconColor(role) : systemColors.gray}
				size={30}
			/>
			<VStack alignment="leading" spacing={2}>
				<Text modifiers={[font({ textStyle: 'body' })]}>
					{role ? roleDisplayName(role) : assignment.roleId}
				</Text>
				{fromSSO ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						From SSO
					</Text>
				) : null}
			</VStack>
			<Spacer />
			{fromSSO ? (
				<Image
					systemName="lock.fill"
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
					]}
				/>
			) : null}
		</HStack>
	);
}

function AssignmentItem({
	model,
	assignment
}: {
	model: UserRoleAssignmentsModel;
	assignment: RoleAssignment;
}) {
	const row = <AssignmentRow assignment={assignment} role={model.roleFor(assignment)} />;
	if (!isManualAssignment(assignment)) return row;
	return (
		<SwipeActions>
			{row}
			<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
				<Button
					label="Remove"
					systemImage="trash"
					onPress={() => model.requestRemove(assignment)}
					modifiers={[tint(systemColors.red)]}
				/>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

export function UserRoleAssignmentsScreen() {
	const model = useUserRoleAssignments();
	const accent = useAccentColor();

	let content;
	if (model.isLoading && model.assignments.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading assignments…" />
			</VStack>
		);
	} else if (model.errorMessage !== undefined && model.assignments.length === 0) {
		content = (
			<ContentUnavailableView
				title="Error"
				systemImage="exclamationmark.triangle"
				description={model.errorMessage}
			/>
		);
	} else if (model.assignments.length === 0) {
		content = (
			<ContentUnavailableView
				title="No Role Assignments"
				systemImage="person.crop.circle.badge.questionmark"
				description="This user has no roles assigned and cannot perform actions."
			/>
		);
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(model.load)]}>
				{model.sections.map((section) => (
					<Section key={section.id} title={section.title}>
						{section.assignments.map((assignment) => (
							<AssignmentItem key={assignment.id} model={model} assignment={assignment} />
						))}
					</Section>
				))}
			</List>
		);
	}

	return (
		<>
			<Stack.Screen options={{ title: 'Role Assignments', headerLargeTitleEnabled: false }} />
			<AppToolbar placement="right" tintColor={accent}>
				<Stack.Toolbar.Button
					icon="plus"
					accessibilityLabel="Add Role Assignment"
					disabled={!model.canAdd}
					onPress={model.openAdd}
				/>
			</AppToolbar>
			<Host style={{ flex: 1 }}>
				{content}
				<ActionErrorAlert
					title="Couldn't Update Assignments"
					message={model.actionErrorMessage}
					onDismiss={model.dismissActionError}
				/>
			</Host>
		</>
	);
}
