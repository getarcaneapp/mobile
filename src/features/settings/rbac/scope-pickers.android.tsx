import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { Role } from '@/sdk/models/role/Role';
import { FormPicker } from '@/ui/components/form-fields';

import { M3Section, RadioGroup } from '../shared/android-material';

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
		<FormPicker
			title="Role"
			selection={selection}
			onSelectionChange={onSelectionChange}
			options={[
				{ label: 'Choose…', value: '' },
				...roles.map((role) => ({ label: roleDisplayName(role), value: role.id }))
			]}
		/>
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
		<M3Section title="Scope" footer={scope === 'global' ? globalFooter : environmentFooter}>
			<RadioGroup
				options={assignmentScopeOptions.map((option) => ({
					value: option.value,
					title: option.label
				}))}
				selection={scope}
				onSelect={onScopeChange}
			/>
			{scope === 'environment' ? (
				<FormPicker
					title="Environment"
					selection={environmentId}
					onSelectionChange={onEnvironmentChange}
					options={[
						{ label: 'Choose…', value: '' },
						...environments.map((environment) => ({
							label: environmentPickerName(environment),
							value: environment.id
						}))
					]}
				/>
			) : null}
		</M3Section>
	);
}
