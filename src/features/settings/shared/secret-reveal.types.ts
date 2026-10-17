/**
 * Props for the one-time secret sheets: `NewAPIKeyView` (CreateAPIKeyView.swift)
 * and `NewWebhookTokenView` (WebhooksView.swift).
 */
export type SecretRevealProps = {
	navigationTitle: string;
	systemImage: string;
	/** Hex. */
	iconColor: string;
	heading: string;
	message: string;
	secret: string;
	/** Caption above the secret (the webhook's name). */
	secretCaption?: string;
	/** `NewAPIKeyView` stretches the secret box to the full width; the webhook box hugs its content. */
	fullWidthSecret?: boolean;
	warning?: string;
	copiedToast: string;
	onDone: () => void;
};
