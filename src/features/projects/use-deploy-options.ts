import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { canonicalServerOrigin } from '@/core/networking/server-identity';
import { defaults } from '@/core/storage';
import { useClientManager } from '@/stores/client-manager';

import { deployOptionsKeyPrefix } from './project-model';
import { routePayloads, type DeployOptionsPayload } from './project-routes';

function currentServerOrigin(): string {
	const { parsedServerURL, serverURL } = useClientManager.getState();
	return (parsedServerURL ? canonicalServerOrigin(parsedServerURL) : undefined) ?? serverURL;
}

export function useDeployOptions() {
	const router = useRouter();
	const { envID = '0', token } = useLocalSearchParams<{ envID?: string; token?: string }>();
	const [payload] = useState(() => routePayloads.get<DeployOptionsPayload>(token));
	useEffect(() => () => routePayloads.delete(token), [token]);

	const [keyPrefix] = useState(() => deployOptionsKeyPrefix(currentServerOrigin(), envID));
	const [pullPolicy, setPullPolicy] = useState(
		() => defaults.getString(`${keyPrefix}.pullPolicy`) ?? 'missing'
	);
	const [forceRecreate, setForceRecreate] = useState(
		() => defaults.getBoolean(`${keyPrefix}.forceRecreate`) ?? false
	);
	const [recreateVolumes, setRecreateVolumes] = useState(false);
	const [showsVolumeWarning, setShowsVolumeWarning] = useState(false);

	const dismiss = () => {
		if (router.canGoBack()) router.back();
	};

	const beginDeploy = () => {
		const options = { pullPolicy, forceRecreate, recreateVolumes };
		setRecreateVolumes(false);
		defaults.set(`${keyPrefix}.pullPolicy`, pullPolicy);
		defaults.set(`${keyPrefix}.forceRecreate`, forceRecreate);
		dismiss();
		payload?.deploy(options);
	};

	return {
		pullPolicy,
		setPullPolicy,
		forceRecreate,
		setForceRecreate,
		recreateVolumes,
		setRecreateVolumes,
		showsVolumeWarning,
		setShowsVolumeWarning,
		cancel: dismiss,
		deploy: () => (recreateVolumes ? setShowsVolumeWarning(true) : beginDeploy()),
		beginDeploy
	};
}

export const deployOptionsConfirmationHost = 'project-deploy-options';
