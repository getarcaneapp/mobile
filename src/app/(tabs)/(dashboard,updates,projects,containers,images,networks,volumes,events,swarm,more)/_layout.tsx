import { Stack } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';

import { useStackScreenOptions } from '@/features/navigation/stack-options';
import { TabStackGroupContext } from '@/features/navigation/tab-stack-group';

export const unstable_settings = {
	anchor: 'dashboard',
	dashboard: { anchor: 'dashboard' },
	updates: { anchor: 'updates' },
	projects: { anchor: 'projects' },
	containers: { anchor: 'containers' },
	images: { anchor: 'images' },
	networks: { anchor: 'networks' },
	volumes: { anchor: 'volumes' },
	events: { anchor: 'events' },
	swarm: { anchor: 'swarm' },
	more: { anchor: 'more' }
};

export default function TabStackLayout({ segment }: { segment?: string }) {
	const screenOptions = useStackScreenOptions();
	return (
		<TabStackGroupContext value={segment}>
			<Stack screenOptions={screenOptions}>
				<Stack.Screen name="containers-filter" options={sheetOptions} />
				<Stack.Screen name="container-configuration" options={largeSheetOptions} />
				<Stack.Screen name="containers-compose" options={largeSheetOptions} />
				<Stack.Screen name="container/[id]/inspect" options={largeSheetOptions} />
				<Stack.Screen name="container/[id]/rename" options={largeSheetOptions} />
				<Stack.Screen name="container/[id]/commit" options={largeSheetOptions} />
				<Stack.Screen name="container/[id]/logs" options={fullScreenOptions} />
				<Stack.Screen name="container/[id]/terminal" options={fullScreenOptions} />
				<Stack.Screen name="activity-center" options={{ ...sheetOptions, headerShown: false }} />
				<Stack.Screen
					name="image-updates-sheet"
					options={{ ...sheetOptions, headerShown: false }}
				/>
				<Stack.Screen name="system-prune" options={sheetOptions} />
				<Stack.Screen name="update-all-environments" options={sheetOptions} />
				<Stack.Screen
					name="environment-color"
					options={{
						...sheetOptions,
						sheetAllowedDetents: [mediumDetent],
						sheetGrabberVisible: false
					}}
				/>
				<Stack.Screen
					name="system-upgrade"
					options={({ route }) =>
						(route.params as { name?: string } | undefined)?.name ? {} : largeSheetOptions
					}
				/>
				<Stack.Screen
					name="settings/profile/recovery-codes"
					options={{ ...largeSheetOptions, gestureEnabled: false }}
				/>
				<Stack.Screen name="settings/backups/create" options={plainLargeSheetOptions} />
				<Stack.Screen name="settings/backups/run-volumes" options={plainLargeSheetOptions} />
				<Stack.Screen name="settings/backups/s3-create" options={plainLargeSheetOptions} />
				<Stack.Screen name="settings/users/create" options={plainLargeSheetOptions} />
				<Stack.Screen name="settings/rbac/new-role" options={plainLargeSheetOptions} />
				<Stack.Screen name="settings/rbac/add-role-assignment" options={plainLargeSheetOptions} />
				<Stack.Screen name="settings/rbac/oidc-mapping" options={plainLargeSheetOptions} />
				<Stack.Screen name="settings/api-keys/create" options={plainLargeSheetOptions} />
				<Stack.Screen name="settings/api-keys/edit" options={plainLargeSheetOptions} />
				<Stack.Screen name="settings/api-keys/secret" options={plainLargeSheetOptions} />
				<Stack.Screen name="settings/federated/form" options={plainLargeSheetOptions} />
				<Stack.Screen name="settings/webhooks/create" options={plainLargeSheetOptions} />
				<Stack.Screen name="settings/webhooks/token" options={plainLargeSheetOptions} />
				<Stack.Screen name="settings/registries/form" options={plainLargeSheetOptions} />
				<Stack.Screen name="settings/templates/registry-form" options={plainLargeSheetOptions} />
				<Stack.Screen name="settings/templates/editor" options={plainLargeSheetOptions} />
				<Stack.Screen name="settings/customize/resource-form" options={plainLargeSheetOptions} />
				<Stack.Screen name="settings/customize/variable-editor" options={largeSheetOptions} />
				<Stack.Screen
					name="settings/customize/variable-delete"
					options={{ ...sheetOptions, sheetAllowedDetents: [mediumDetent] }}
				/>
				<Stack.Screen
					name="settings/app/all-environments-introduction"
					options={plainLargeSheetOptions}
				/>
				<Stack.Screen
					name="settings/app/refreshed-dashboard-introduction"
					options={plainLargeSheetOptions}
				/>
				<Stack.Screen name="images-filter" options={sheetOptions} />
				<Stack.Screen name="image-pull" options={sheetOptions} />
				<Stack.Screen name="image-upload" options={sheetOptions} />
				<Stack.Screen name="image-prune" options={largeSheetOptions} />
				<Stack.Screen name="image/[id]/tag" options={largeSheetOptions} />
				<Stack.Screen name="image/[id]/attestation" options={largeSheetOptions} />
				<Stack.Screen name="security-filter" options={sheetOptions} />
				<Stack.Screen name="vulnerability-ignore" options={largeSheetOptions} />
				<Stack.Screen name="volumes-filter" options={sheetOptions} />
				<Stack.Screen name="volume-create" options={sheetOptions} />
				<Stack.Screen name="volume/[name]/rename" options={largeSheetOptions} />
				<Stack.Screen name="volume/[name]/backup-create" options={largeSheetOptions} />
				<Stack.Screen name="volume/[name]/workspace-action" options={largeSheetOptions} />
				<Stack.Screen name="volume/[name]/workspace-file" options={largeSheetOptions} />
				<Stack.Screen name="volume/[name]/workspace-review" options={largeSheetOptions} />
				<Stack.Screen name="projects-filter" options={sheetOptions} />
				<Stack.Screen name="create-project" options={largeSheetOptions} />
				<Stack.Screen name="project-deploy-options" options={largeSheetOptions} />
				<Stack.Screen name="project-tags" options={largeSheetOptions} />
				<Stack.Screen
					name="project-files"
					options={{ ...largeSheetOptions, sheetGrabberVisible: false }}
				/>
				<Stack.Screen name="render-compose" options={largeSheetOptions} />
				<Stack.Screen name="project-draft-review" options={largeSheetOptions} />
				<Stack.Screen name="project-file-dialog" options={sheetOptions} />
				<Stack.Screen name="deployment-activity" options={largeSheetOptions} />
				<Stack.Screen name="project/[id]/logs" options={fullScreenOptions} />
				<Stack.Screen name="networks-filter" options={sheetOptions} />
				<Stack.Screen name="network-create" options={sheetOptions} />
				<Stack.Screen name="network/[id]/connect" options={largeSheetOptions} />
				<Stack.Screen name="topology-node" options={sheetOptions} />
				<Stack.Screen name="swarm-service-editor" options={largeSheetOptions} />
				<Stack.Screen
					name="swarm-service-scale"
					options={{
						...sheetOptions,
						sheetAllowedDetents: [mediumDetent],
						sheetGrabberVisible: false
					}}
				/>
				<Stack.Screen name="swarm-stack-editor" options={largeSheetOptions} />
				<Stack.Screen name="swarm-kv-create" options={largeSheetOptions} />
				<Stack.Screen name="swarm-service/[id]/logs" options={fullScreenOptions} />
			</Stack>
		</TabStackGroupContext>
	);
}

type ScreenOptions = NonNullable<
	Exclude<ComponentProps<typeof Stack.Screen>['options'], (...args: never[]) => unknown>
>;

const mediumDetent = Platform.OS === 'ios' ? 0.56 : 0.5;

const sheetOptions: ScreenOptions = {
	presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal',
	sheetAllowedDetents: [mediumDetent, 1],
	sheetGrabberVisible: true,
	headerShown: Platform.OS === 'android',
	headerLargeTitleEnabled: false,
	headerTransparent: false
};

const largeSheetOptions: ScreenOptions = { ...sheetOptions, sheetAllowedDetents: [1] };

const plainLargeSheetOptions: ScreenOptions = { ...largeSheetOptions, sheetGrabberVisible: false };

const fullScreenOptions: ScreenOptions = {
	presentation: 'fullScreenModal',
	headerShown: true,
	headerLargeTitleEnabled: false,
	headerTransparent: false
};
