import { useEffect, useState } from 'react';

export type DemoBannerProps = {
	endsAt: Date;
	onEnd: () => void;
};

function secondsUntil(endsAt: Date) {
	return Math.max(0, (endsAt.getTime() - Date.now()) / 1000);
}

export function useRemainingSeconds(endsAt: Date) {
	const [remaining, setRemaining] = useState(() => secondsUntil(endsAt));
	useEffect(() => {
		setRemaining(secondsUntil(endsAt));
		const timer = setInterval(() => setRemaining(secondsUntil(endsAt)), 1000);
		return () => clearInterval(timer);
	}, [endsAt]);
	return remaining;
}

export function formatRemaining(seconds: number) {
	const total = Math.round(seconds);
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} remaining`;
}
