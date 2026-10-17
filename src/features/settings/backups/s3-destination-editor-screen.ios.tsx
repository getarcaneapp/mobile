import { Button, Section, Text, Toggle } from '@expo/ui/swift-ui';
import {
	autocorrectionDisabled,
	disabled,
	textInputAutocapitalization
} from '@expo/ui/swift-ui/modifiers';

import type { S3Destination } from '@/sdk/models/backup/S3Destination';
import { FormSecureField, FormTextField } from '@/ui/components/form-fields';

import { BackupFormChrome } from './backup-form-chrome';
import { useS3DestinationParam } from './backup-routes';
import { RedText } from './backup-rows';
import { useS3DestinationEditor } from './use-s3-destinations';

function S3DestinationEditor({
	destination,
	presentation
}: {
	destination: S3Destination | undefined;
	presentation: 'push' | 'sheet';
}) {
	const model = useS3DestinationEditor(destination);
	const text = (
		title: string,
		value: string,
		onChange: (text: string) => void,
		options: { url?: boolean; stacked?: boolean } = {}
	) => (
		<FormTextField
			title={title}
			placeholder=""
			text={value}
			onChangeText={onChange}
			keyboardType={options.url ? 'url' : 'default'}
			autocapitalization="never"
			autocorrectionDisabled
			layout={options.stacked ? 'stacked' : 'automatic'}
		/>
	);
	return (
		<BackupFormChrome
			title={model.title}
			presentation={presentation}
			disabled={model.busy}
			onCancel={model.cancel}
			confirm={
				model.canSave
					? { label: model.saveTitle, disabled: !model.valid || model.busy, onPress: model.save }
					: undefined
			}
			formModifiers={[textInputAutocapitalization('never'), autocorrectionDisabled()]}
		>
			{model.errorMessage !== undefined ? <RedText>{model.errorMessage}</RedText> : null}
			<Section title="Destination">
				{text('Name', model.name, model.setName)}
				{text('Endpoint', model.endpoint, model.setEndpoint, { url: true })}
				{text('Bucket', model.bucket, model.setBucket)}
				{text('Region', model.region, model.setRegion)}
				{text('Prefix', model.prefix, model.setPrefix, { stacked: true })}
				<Toggle label="Use SSL" isOn={model.useSSL} onIsOnChange={model.setUseSSL} />
				<Toggle
					label="Force path style"
					isOn={model.forcePathStyle}
					onIsOnChange={model.setForcePathStyle}
				/>
			</Section>
			<Section
				footer={
					!model.isNew ? (
						<Text>Leave the secret empty to keep the stored credential.</Text>
					) : undefined
				}
			>
				{text('Access key ID', model.accessKeyID, model.setAccessKeyID)}
				<FormSecureField
					title="Secret access key"
					placeholder=""
					text={model.secret}
					onChangeText={model.setSecret}
				/>
			</Section>
			{model.canTest ? (
				<Button label="Test connection" onPress={model.test} modifiers={[disabled(!model.valid)]} />
			) : null}
		</BackupFormChrome>
	);
}

export function S3DestinationEditorScreen() {
	const destination = useS3DestinationParam();
	return <S3DestinationEditor destination={destination} presentation="push" />;
}

export function S3DestinationCreateScreen() {
	return <S3DestinationEditor destination={undefined} presentation="sheet" />;
}
