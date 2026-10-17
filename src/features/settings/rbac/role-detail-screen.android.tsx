/** Android rendering of `RoleDetailView` (RolesView.swift) in its pushed `.edit` / `.readOnly` modes. */
import { RoleDetailForm } from './role-detail-form';
import { useRoleDetail } from './use-role-detail';

export function RoleDetailScreen() {
	const model = useRoleDetail('readOnly');
	return <RoleDetailForm model={model} />;
}
