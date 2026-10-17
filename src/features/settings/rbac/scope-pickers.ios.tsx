import { Picker, Section, Text } from '@expo/ui/swift-ui';
import { tag } from '@expo/ui/swift-ui/modifiers';

import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { Role } from '@/sdk/models/role/Role';

import {
	assignmentScopeOptions,
	environmentPickerName,
	roleDisplayName,
	type AssignmentScope
} from './rbac-models';

export function RolePicker({
	roles,
	selection,
	onSelectionChange
}: {
	roles: Role[];
	selection: string;
	onSelectionChange: (id: string) => void;
}) {
	return (
		<Picker label="Role" selection={selection} onSelectionChange={onSelectionChange}>
			<Text modifiers={[tag('')]}>Choose…</Text>
			{roles.map((role) => (
				<Text key={role.id} modifiers={[tag(role.id)]}>
					{roleDisplayName(role)}
				</Text>
			))}
		</Picker>
	);
}

export function ScopeSection({
	scope,
	onScopeChange,
	environments,
	environmentId,
	onEnvironmentChange,
	globalFooter,
	environmentFooter
}: {
	scope: AssignmentScope;
	onScopeChange: (scope: AssignmentScope) => void;
	environments: Environment[];
	environmentId: string;
	onEnvironmentChange: (id: string) => void;
	globalFooter: string;
	environmentFooter: string;
}) {
	return (
		<Section
			header={<Text>Scope</Text>}
			footer={<Text>{scope === 'global' ? globalFooter : environmentFooter}</Text>}
		>
			<Picker label="Scope" selection={scope} onSelectionChange={onScopeChange}>
				{assignmentScopeOptions.map((option) => (
					<Text key={option.value} modifiers={[tag(option.value)]}>
						{option.label}
					</Text>
				))}
			</Picker>
			{scope === 'environment' ? (
				<Picker
					label="Environment"
					selection={environmentId}
					onSelectionChange={onEnvironmentChange}
				>
					<Text modifiers={[tag('')]}>Choose…</Text>
					{environments.map((environment) => (
						<Text key={environment.id} modifiers={[tag(environment.id)]}>
							{environmentPickerName(environment)}
						</Text>
					))}
				</Picker>
			) : null}
		</Section>
	);
}
