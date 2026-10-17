export type SecretRevealProps = {
	navigationTitle: string;
	systemImage: string;
	iconColor: string;
	heading: string;
	message: string;
	secret: string;
	secretCaption?: string;
	fullWidthSecret?: boolean;
	warning?: string;
	copiedToast: string;
	onDone: () => void;
};
