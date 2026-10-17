import { useLocalSearchParams } from 'expo-router';

import { JobScheduleConfigView } from '@/features/jobs/job-schedule-config-screen';

export default function Route() {
	const { id = '0', name } = useLocalSearchParams<{ id?: string; name?: string }>();
	return (
		<JobScheduleConfigView
			key={id}
			environmentID={id}
			environmentName={name === '' ? undefined : name}
		/>
	);
}
