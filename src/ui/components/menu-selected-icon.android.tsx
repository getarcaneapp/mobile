import { DropdownMenuItem, Icon as ComposeIcon } from '@expo/ui/jetpack-compose';
import type { ImageSourcePropType } from 'react-native';

import { useToolbarIcons } from '@/ui/toolbar-icon';

export function useMenuCheckIcon(): ImageSourcePropType | undefined {
	const icon = useToolbarIcons(['checkmark']);
	const source = icon('checkmark');
	return typeof source === 'string' ? undefined : source;
}

export function MenuSelectedIcon({
	selected,
	source
}: {
	selected: boolean;
	source: ImageSourcePropType | undefined;
}) {
	if (!selected || !source) return null;
	return (
		<DropdownMenuItem.TrailingIcon>
			<ComposeIcon source={source} size={24} />
		</DropdownMenuItem.TrailingIcon>
	);
}
