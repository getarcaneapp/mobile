import { RoleDetailForm } from './role-detail-form';
import { useRoleDetail } from './use-role-detail';

export function NewRoleScreen() {
	const model = useRoleDetail('create');
	return <RoleDetailForm model={model} />;
}
