import { useLocalSearchParams } from 'expo-router';

import { ImageVulnerabilitiesView } from './image-vulnerabilities-view';

/** Route entry for the standalone `ImageVulnerabilitiesView` (`image/[id]/vulnerabilities?envID=&name=`). */
export function ImageVulnerabilitiesRoute() {
	const {
		id = '',
		envID = '0',
		name = ''
	} = useLocalSearchParams<{ id?: string; envID?: string; name?: string }>();
	return (
		<ImageVulnerabilitiesView
			key={`${envID}|${id}`}
			imageID={id}
			imageDisplayName={name}
			environmentID={envID}
		/>
	);
}
