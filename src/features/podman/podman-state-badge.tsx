import { ResourceStatusBadge } from '@/ui/components/resource-status-badge';

import { podmanBadgeStatus, podmanStateLabel } from './podman-logic';

export function PodmanStateBadge({
	state,
	usesCardStyle = true
}: {
	state: string | undefined;
	usesCardStyle?: boolean;
}) {
	return (
		<ResourceStatusBadge
			status={podmanBadgeStatus(state)}
			isLive={false}
			usesCardStyle={usesCardStyle}
			label={podmanStateLabel(state)}
		/>
	);
}
