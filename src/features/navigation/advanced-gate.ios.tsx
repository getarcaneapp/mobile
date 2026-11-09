import { useAdvancedFeatures } from '@/core/advanced-features';
import { UnavailableView } from '@/ui/components/unavailable-view';
import { Host } from '@/ui/host';

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
		<Host style={{ flex: 1 }}>
			<UnavailableView
				title={advancedGateTitle}
				systemImage={advancedGateSymbol}
				actions={[{ title: advancedGateAction, onPress: () => setEnabled(true) }]}
			/>
		</Host>
	);
}
