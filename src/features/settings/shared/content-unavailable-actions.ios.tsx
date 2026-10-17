import { UnavailableView } from '@/ui/components/unavailable-view';

export type UnavailableAction = { title: string; onPress: () => void };

export function ContentUnavailableWithActions(props: {
	title: string;
	systemImage: string;
	description?: string;
	actions?: UnavailableAction[];
}) {
	return <UnavailableView {...props} />;
}
