import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { materialSymbol } from './symbols';

type Props = Omit<SymbolViewProps, 'name' | 'tintColor'> & {
	/** SF Symbol name; Android renders the mapped Material Symbol. */
	name: string;
	color?: ColorValue;
};

/** `Image(systemName:)` for React Native trees on both platforms. */
export function Icon({ name, color, size = 17, ...rest }: Props) {
	return (
		<SymbolView
			{...rest}
			size={size}
			tintColor={color as string | undefined}
			name={{
				ios: name as never,
				android: materialSymbol(name) as never,
				web: materialSymbol(name) as never
			}}
		/>
	);
}
