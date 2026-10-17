import { Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { EnvironmentLabel } from '@/ui/components/environment-label';
import { imageReferenceParts } from '@/ui/components/image-reference';
import { UpdateStateBadge } from '@/ui/components/labels';
import { updateStatePresentation } from '@/ui/components/labels.types';
import { ImageReferenceName, RowIcon, TagChip } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';

import type { ImageRowModel } from './use-images-list';

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
		<View
			accessible
			accessibilityLabel={description}
			style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 2 }}
		>
			<RowIcon systemImage="square.3.layers.3d.top.filled" tint={systemColors.purple} />
			<View style={{ flex: 1, gap: 5 }}>
				<ImageReferenceName reference={reference} />
				<View
					style={{
						flexDirection: 'row',
						flexWrap: 'wrap',
						alignItems: 'center',
						columnGap: 8,
						rowGap: 5
					}}
				>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
