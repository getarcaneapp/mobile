export interface UpdateAllEnvironmentsScreenProps {
	/** Defaults to the route's `count` param. */
	environmentCount?: number;
	/**
	 * Skip the in-sheet confirmation and trigger the run as soon as preflight
	 * finds no job in progress. Defaults to `true` (the dashboard confirms on its
	 * own button, matching the Swift call site).
	 */
	startsImmediately?: boolean;
}
