import { useEffect, useState } from 'react';

import type { InstallStreamStatus } from './install-stream.types';

/**
 * Success sweep (DeploymentPillView.sweepToCheckmark): the border fills all
 * the way around in green, then the checkmark pops in and the border fades.
 * Reduce Motion goes straight to the checkmark.
 */
export function useCompletionSweep(status: InstallStreamStatus, reduceMotion: boolean) {
	const [completionFill, setCompletionFill] = useState<number>();
	const [showsCheckmark, setShowsCheckmark] = useState(false);

	useEffect(() => {
		if (status.kind !== 'success') return;
		if (reduceMotion) {
			setShowsCheckmark(true);
			return;
		}
		setCompletionFill(0);
		const timers = [
			setTimeout(() => setCompletionFill(1), 32),
			setTimeout(() => setShowsCheckmark(true), 32 + 650),
			setTimeout(() => setCompletionFill(undefined), 32 + 650 + 350)
		];
		return () => timers.forEach(clearTimeout);
	}, [status.kind, reduceMotion]);

	return { completionFill, showsCheckmark };
}
