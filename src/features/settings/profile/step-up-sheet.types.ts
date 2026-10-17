export type StepUpSheetProps = {
	isPresented: boolean;
	allowsPassword: boolean;
	allowsPasskey: boolean;
	authenticateWithPassword: (password: string) => Promise<string | undefined>;
	authenticateWithPasskey: () => Promise<string | undefined>;
	cancel: () => void;
	onDismissed: () => void;
};
