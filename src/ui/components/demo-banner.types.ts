import { useEffect, useState } from 'react';

export type DemoBannerProps = {
	/** When the demo session ends (`manager.demoEndsAt`). Render nothing when no demo is active. */
	endsAt: Date;
	/** `manager.endDemo(reason: .userInitiated)`. */
	onEnd: () => void;
};

/** Seconds remaining, ticking once a second (the Swift 1 Hz TimelineView). */
export function useRemainingSeconds(endsAt: Date) {
	const compute = () => Math.max(0, (endsAt.getTime() - Date.now()) / 1000);
	const [remaining, setRemaining] = useState(compute);
	useEffect(() => {
		setRemaining(compute());
		const timer = setInterval(() => setRemaining(compute()), 1000);
		return () => clearInterval(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [endsAt]);
	return remaining;
}

/** "m:ss remaining". */
export function formatRemaining(seconds: number) {
	const total = Math.round(seconds);
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} remaining`;
}
