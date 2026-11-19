import { View } from 'react-native';

import { useAdvancedFeatures } from '@/core/advanced-features';
import { colors } from '@/theme/colors';
import { UnavailableView } from '@/ui/components/unavailable-view';

import {
	advancedGateAction,
	advancedGateSymbol,
	advancedGateTitle,
	type AdvancedGateProps
} from './advanced-gate.types';

export function AdvancedGate({ children }: AdvancedGateProps) {
	const [enabled, setEnabled] = useAdvancedFeatures();
	if (enabled) return children;
	return (
		<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
			<UnavailableView
				title={advancedGateTitle}
				systemImage={advancedGateSymbol}
				actions={[{ title: advancedGateAction, onPress: () => setEnabled(true) }]}
			/>
		</View>
	);
}
