export type RunEndpointButtonProps = {
	title: string;
	systemImage: string;
	run: () => Promise<void>;
	destructive?: boolean;
	formatError?: (error: unknown) => string;
};

export const defaultFormatError = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

export type DynamicNavigationRowProps = {
	title: string;
	subtitle: string;
	systemImage: string;
	onPress: () => void;
};
