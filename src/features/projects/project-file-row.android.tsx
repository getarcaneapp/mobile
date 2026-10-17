import { ActivityIndicator, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

export type ProjectFileBrowserRowProps = {
	name: string;
	detail?: string;
	systemImage: string;
	isDirectory: boolean;
	isProtected?: boolean;
	hasChanges?: boolean;
	depth?: number;
	isLoading?: boolean;
	showsDisclosure?: boolean;
};

export function ProjectFileBrowserRow({
	name,
	detail,
	systemImage,
	isDirectory,
	isProtected = false,
	hasChanges = false,
	depth = 0,
	isLoading = false,
	showsDisclosure = true
}: ProjectFileBrowserRowProps) {
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				paddingLeft: depth * 16,
				flex: 1
			}}
		>
			<View style={{ width: 24, alignItems: 'center' }}>
				<Icon
					name={systemImage}
					size={22}
					color={isDirectory ? m3.primary : colors.secondaryLabel}
				/>
			</View>
			<View style={{ flex: 1, gap: 2 }}>
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
					<Text
						numberOfLines={1}
						style={[m3Type.bodyLarge, { color: colors.label, flexShrink: 1 }]}
					>
						{name}
					</Text>
					{isProtected ? <Icon name="lock.fill" size={12} color={colors.secondaryLabel} /> : null}
					{hasChanges ? (
						<View
							style={{
								width: 7,
								height: 7,
								borderRadius: 3.5,
								backgroundColor: systemColors.orange
							}}
						/>
					) : null}
				</View>
				{detail ? (
					<Text numberOfLines={1} style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
						{detail}
					</Text>
				) : null}
			</View>
			{isLoading ? (
				<ActivityIndicator size="small" />
			) : showsDisclosure ? (
				<Icon name="chevron.right" size={18} color={colors.secondaryLabel} />
			) : null}
		</View>
	);
}
