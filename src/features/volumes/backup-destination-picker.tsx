import type { S3Destination } from '@/sdk/models/backup/S3Destination';
import { FormPicker } from '@/ui/components/form-fields';

export function backupDestinationOptions(selection: string, destinations: S3Destination[]) {
	const options = [
		{ label: 'Select destination', value: '' },
		...destinations.map((d) => ({ label: d.name, value: d.id }))
	];
	if (selection !== '' && !destinations.some((d) => d.id === selection))
		options.push({ label: selection, value: selection });
	return options;
}

export function BackupDestinationPicker({
	selection,
	onSelectionChange,
	destinations
}: {
	selection: string;
	onSelectionChange: (value: string) => void;
	destinations: S3Destination[];
}) {
	return (
		<FormPicker
			title="S3 destination"
			selection={selection}
			onSelectionChange={onSelectionChange}
			options={backupDestinationOptions(selection, destinations)}
		/>
	);
}
