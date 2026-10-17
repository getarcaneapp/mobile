import type { DeleteConfirmationConfig } from './presenter';

export type DeleteConfirmationCardProps = {
	config: DeleteConfirmationConfig;
	onResolved: (action: (() => void) | undefined) => void;
};

export const exitDelay = (reduceMotion: boolean) => (reduceMotion ? 170 : 340);
