/**
 * `if let error { Section { Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(.red) } }`
 * — the inline save/load failure row the Settings forms end with.
 *
 * SwiftUI-tree (place inside a `Form`).
 */
import { Label, Section } from '@expo/ui/swift-ui';
import { foregroundStyle } from '@expo/ui/swift-ui/modifiers';

import { systemColors } from '@/theme/colors';

export function FormErrorSection({ message }: { message: string | undefined }) {
	if (message === undefined) return null;
	return (
		<Section>
			<Label
				title={message}
				systemImage="exclamationmark.triangle"
				modifiers={[foregroundStyle(systemColors.red)]}
			/>
		</Section>
	);
}
