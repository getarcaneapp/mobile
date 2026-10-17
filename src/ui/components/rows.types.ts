export type RunEndpointButtonProps = {
	title: string;
	systemImage: string;
	/**
	 * Performs the request (Swift: `client.transport.rawRequest(path, method: "POST", body: {})`).
	 * Resolve on success; throw on failure.
	 */
	run: () => Promise<void>;
	destructive?: boolean;
	/** `friendlyErrorMessage(_:)`; defaults to the error's message. */
	formatError?: (error: unknown) => string;
};

export const defaultFormatError = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

export type DynamicNavigationRowProps = {
	title: string;
	subtitle: string;
	systemImage: string;
	/** Push the destination (`router.push(...)`). */
	onPress: () => void;
};
