export type PodmanMenuAction = {
	id: string;
	title: string;
	systemImage: string;
	destructive?: boolean;
	onPress: () => void;
};
