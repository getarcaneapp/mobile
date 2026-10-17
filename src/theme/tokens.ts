export const Radius = {
	small: 8,
	nested: 12,
	standard: 16,
	card: 22,
	hero: 28,
	concentric: (outer: number, inset: number) => Math.max(outer - inset, 4)
} as const;

type Spring = { type: 'spring'; response: number; dampingFraction: number };
type Timing = {
	type: 'timing';
	duration: number;
	easing: 'easeOut' | 'easeInOut' | 'linear' | 'smooth';
};

export const Motion = {
	state: { type: 'timing', duration: 250, easing: 'smooth' } as Timing,
	press: { type: 'spring', response: 0.28, dampingFraction: 0.86 } as Spring,
	earlyFade: { type: 'timing', duration: 100, easing: 'easeOut' } as Timing,
	reflow: { type: 'timing', duration: 300, easing: 'smooth' } as Timing,
	entrance: { type: 'spring', response: 0.42, dampingFraction: 0.85 } as Spring,
	overlay: { type: 'spring', response: 0.3, dampingFraction: 1 } as Spring,
	toast: { type: 'spring', response: 0.35, dampingFraction: 1 } as Spring,
	gauge: { type: 'spring', response: 0.55, dampingFraction: 0.85 } as Spring,
	gaugeReveal: { type: 'spring', response: 0.9, dampingFraction: 0.8 } as Spring,
	logoEntrance: { type: 'spring', response: 0.55, dampingFraction: 0.62 } as Spring,
	splashEnter: { type: 'spring', response: 0.7, dampingFraction: 0.78 } as Spring,
	splashSheen: { type: 'timing', duration: 800, easing: 'easeInOut' } as Timing,
	splashExit: { type: 'spring', response: 0.6, dampingFraction: 0.86 } as Spring,
	follow: { type: 'timing', duration: 100, easing: 'linear' } as Timing,
	chartScroll: { type: 'timing', duration: 2000, easing: 'linear' } as Timing,
	completionSweep: { type: 'timing', duration: 600, easing: 'easeInOut' } as Timing,
	reducedFallback: { type: 'timing', duration: 200, easing: 'easeOut' } as Timing,
	stagger: 45
} as const;

export type MotionToken = Spring | Timing;
