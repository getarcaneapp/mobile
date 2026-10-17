/** Android rendering of `S3DestinationEditor` (S3DestinationsView.swift). */
import type { S3Destination } from '@/sdk/models/backup/S3Destination';
import { FormSecureField, FormTextField } from '@/ui/components/form-fields';

import { M3Section, SwitchRow, TextButtonRow } from '../shared/android-material';
import { AndroidErrorText, AndroidFormScreen } from './backup-android';
import { useS3DestinationParam } from './backup-routes';
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
		<AndroidFormScreen
			title={model.title}
			disabled={model.busy}
			cancel={presentation === 'sheet' ? model.cancel : undefined}
			confirm={
				model.canSave
					? { label: model.saveTitle, disabled: !model.valid || model.busy, onPress: model.save }
					: undefined
			}
		>
			<AndroidErrorText message={model.errorMessage} />
			<M3Section title="Destination">
				{text('Name', model.name, model.setName)}
				{text('Endpoint', model.endpoint, model.setEndpoint, { url: true })}
				{text('Bucket', model.bucket, model.setBucket)}
				{text('Region', model.region, model.setRegion)}
				{text('Prefix', model.prefix, model.setPrefix, { stacked: true })}
				<SwitchRow title="Use SSL" value={model.useSSL} onValueChange={model.setUseSSL} />
				<SwitchRow
					title="Force path style"
					value={model.forcePathStyle}
					onValueChange={model.setForcePathStyle}
				/>
			</M3Section>
			<M3Section
				footer={!model.isNew ? 'Leave the secret empty to keep the stored credential.' : undefined}
			>
				{text('Access key ID', model.accessKeyID, model.setAccessKeyID)}
				<FormSecureField
					title="Secret access key"
					placeholder=""
					text={model.secret}
					onChangeText={model.setSecret}
				/>
			</M3Section>
			{model.canTest ? (
				<M3Section>
					<TextButtonRow title="Test connection" disabled={!model.valid} onPress={model.test} />
				</M3Section>
			) : null}
		</AndroidFormScreen>
	);
}

export function S3DestinationEditorScreen() {
	const destination = useS3DestinationParam();
	return <S3DestinationEditor destination={destination} presentation="push" />;
}

export function S3DestinationCreateScreen() {
	return <S3DestinationEditor destination={undefined} presentation="sheet" />;
}
