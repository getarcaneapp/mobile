/** Props for the `StepUpAuthenticationSheet` port (PasskeysMFAView.swift). */
export type StepUpSheetProps = {
	isPresented: boolean;
	allowsPassword: boolean;
	allowsPasskey: boolean;
	/** Resolve with an error message to show, or `undefined` on success / cancel. */
	authenticateWithPassword: (password: string) => Promise<string | undefined>;
	authenticateWithPasskey: () => Promise<string | undefined>;
	/** Cancel button: drops the queued action and closes the sheet. */
	cancel: () => void;
	/** Swipe-dismissed (Swift's binding just turns false). */
	onDismissed: () => void;
};
