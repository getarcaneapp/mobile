import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentColorStore } from '@/stores/environment-color-store';
import { AccentColorOptions } from '@/theme/accent';
import { showToast, Toasts } from '@/ui/toast';

export type EnvironmentColorPickerProps = {
	environmentID: string;
	displayName: string;
};

const blueHex = AccentColorOptions.find((option) => option.id === 'blue')?.hex ?? '#007AFF';

export function useEnvironmentColorPicker(environmentID: string) {
	const server = useClientManager((s) => s.serverURL);
	const selectedHex = useEnvironmentColorStore((s) => s.hex(server, environmentID)) ?? blueHex;
	const colors = useEnvironmentColorStore((s) => s.colors);
	return {
		selectedHex,
		save: (hex: string) => {
			if (!useEnvironmentColorStore.getState().set(hex, server, environmentID)) {
				showToast(
					Toasts.info(
						'That color is already used by another environment. Choose a different color.'
					)
				);
			}
		},
		isAvailable: (hex: string) =>
			colors !== undefined &&
			useEnvironmentColorStore.getState().isAvailable(hex, server, environmentID),
		reset: () => {
			useEnvironmentColorStore.getState().set(undefined, server, environmentID);
		}
	};
}
