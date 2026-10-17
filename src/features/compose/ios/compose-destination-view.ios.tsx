import { NavigationDestination, NavigationStack } from '@expo/ui/swift-ui';
import type { ModifierConfig } from '@expo/ui/swift-ui/modifiers';
import { useState, type ReactNode } from 'react';

import {
	decodeComposeDestination,
	isComposeDestination,
	type ComposeDestination
} from '../compose-destinations';
import {
	ComposeCollectionForm,
	ComposeEnvironmentFileEntry,
	ComposeHealthcheckForm,
	ComposeMappingForm,
	ComposeNetworkAttachmentDetail,
	ComposeNetworkAttachmentsForm,
	ComposeStringListForm
} from './compose-forms.ios';
import { ComposeNativeFieldsForm } from './compose-native-fields.ios';
import { ComposePreviewEditor, EnvPreviewEditor } from './compose-preview-editor.ios';
import {
	ComposeResourceDefinitionForm,
	ComposeResourceDefinitionList
} from './compose-resources.ios';
import { ComposeServiceForm, ServiceSubform } from './compose-service-form.ios';

export function ComposeDestinationContent({ destination }: { destination: ComposeDestination }) {
	switch (destination.screen) {
		case 'editor':
			return <ComposePreviewEditor destination={destination} />;
		case 'envEditor':
			return <EnvPreviewEditor destination={destination} />;
		case 'service':
			return <ComposeServiceForm destination={destination} />;
		case 'imageSettings':
		case 'runtime':
		case 'identity':
		case 'nameResolution':
		case 'pullPolicy':
			return <ServiceSubform destination={destination} />;
		case 'nativeFields':
			return <ComposeNativeFieldsForm destination={destination} />;
		case 'mapping':
			return <ComposeMappingForm destination={destination} />;
		case 'collection':
			return <ComposeCollectionForm destination={destination} />;
		case 'stringList':
			return <ComposeStringListForm destination={destination} />;
		case 'healthcheck':
			return <ComposeHealthcheckForm destination={destination} />;
		case 'networkAttachments':
			return <ComposeNetworkAttachmentsForm destination={destination} />;
		case 'networkAttachment':
			return <ComposeNetworkAttachmentDetail destination={destination} />;
		case 'resourceList':
			return <ComposeResourceDefinitionList destination={destination} />;
		case 'resourceForm':
			return <ComposeResourceDefinitionForm destination={destination} />;
		case 'envFile':
			return <ComposeEnvironmentFileEntry destination={destination} />;
	}
}

export function ComposeDestinationView({ value }: { value: string }) {
	const destination = decodeComposeDestination(value);
	return destination ? <ComposeDestinationContent destination={destination} /> : null;
}

export { isComposeDestination };

export function ComposeNavigationStack({
	children,
	modifiers
}: {
	children: ReactNode;
	modifiers?: ModifierConfig[];
}) {
	const [path, setPath] = useState<string[]>([]);
	return (
		<NavigationStack path={path} onPathChange={setPath} modifiers={modifiers}>
			{children}
			{path.map((value) => (
				<NavigationDestination key={value} value={value}>
					<ComposeDestinationView value={value} />
				</NavigationDestination>
			))}
		</NavigationStack>
	);
}
