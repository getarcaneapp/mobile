import type { DeleteConfirmationConfig } from './presenter';

export type DeleteConfirmationCardProps = {
	config: DeleteConfirmationConfig;
	/**
	 * Invoked once the exit animation finishes. `undefined` means cancelled;
	 * otherwise it's the chosen action, run after the card is gone.
	 */
	onResolved: (action: (() => void) | undefined) => void;
};

/** Exit wait before handing back to the host (Swift: 340 ms, 170 ms with Reduce Motion). */
export const exitDelay = (reduceMotion: boolean) => (reduceMotion ? 170 : 340);
