import { Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { EnvironmentLabel } from '@/ui/components/environment-label';
import { imageReferenceParts } from '@/ui/components/image-reference';
import { UpdateStateBadge } from '@/ui/components/labels';
import { updateStatePresentation } from '@/ui/components/labels.types';
import { ImageReferenceName, RowIcon, TagChip } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';

import type { ImageRowModel } from './use-images-list';

const containerStyle = {
	flexDirection: 'row' as const,
	alignItems: 'center' as const,
	gap: 12,
	paddingVertical: 2
};
const bodyStyle = { flex: 1, gap: 5 };
const metaStyle = {
	flexDirection: 'row' as const,
	flexWrap: 'wrap' as const,
	alignItems: 'center' as const,
	columnGap: 8,
	rowGap: 5
};
const tagLineStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 };

export function ImageRow({
	row,
	environmentName,
	environmentColor
}: {
	row: ImageRowModel;
	environmentName?: string;
	environmentColor?: string;
}) {
	const reference = imageReferenceParts(row.displayName);
	const description = [
		row.displayName,
		row.sizeText,
		updateStatePresentation(row.updateState).accessibility,
		...(environmentName ? [environmentName] : [])
	].join(', ');
	return (
		<View accessible accessibilityLabel={description} style={containerStyle}>
			<RowIcon systemImage="square.3.layers.3d.top.filled" tint={systemColors.purple} />
			<View style={bodyStyle}>
				<ImageReferenceName reference={reference} />
				<View style={metaStyle}>
					<View style={tagLineStyle}>
						{reference.tag ? <TagChip text={reference.tag} /> : null}
						<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
							{row.sizeText}
						</Text>
					</View>
					<UpdateStateBadge state={row.updateState} />
				</View>
				<EnvironmentLabel name={environmentName} color={environmentColor} />
			</View>
		</View>
	);
}
