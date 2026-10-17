import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { SwarmInfo } from '@/sdk/models/swarm/SwarmInfo';
import { Permission } from '@/sdk/models/role/Permission';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { useOnChange } from '@/features/containers/hooks';

import { optionalTrimmed, swarmChanged, useCan, useSwarmVersion } from './swarm-common';

export function useSwarmHub(environmentID: EnvironmentID) {
	const client = useClientManager((s) => s.client);
	const [isActive, setIsActive] = useState<boolean>();
	const [info, setInfo] = useState<SwarmInfo>();
	const [errorMessage, setErrorMessage] = useState<string>();
	const isLoading = useRef(false);
	const swarmVersion = useSwarmVersion(environmentID);

	const load = useCallback(async () => {
		const current = useClientManager.getState().client;
		if (!current || isLoading.current) return;
		isLoading.current = true;
		try {
			const fetched = await current.swarm.info({ envID: environmentID }).catch(() => undefined);
			if (fetched) {
				setInfo(fetched);
				setIsActive(true);
				setErrorMessage(undefined);
				return;
			}
			try {
				const status = await current.swarm.status({ envID: environmentID });
				setIsActive(status.enabled);
				setInfo(undefined);
				setErrorMessage(undefined);
			} catch (error) {
				setErrorMessage(friendlyErrorMessage(error));
			}
		} finally {
			isLoading.current = false;
		}
	}, [environmentID]);

	useEffect(() => {
		void load();
	}, [load, client]);
	useOnChange(swarmVersion, () => void load());

	return { isActive, info, errorMessage, load };
}

export function useSwarmSetup(environmentID: EnvironmentID) {
	const can = useCan(environmentID);
	const [listenAddress, setListenAddress] = useState('');
	const [advertiseAddress, setAdvertiseAddress] = useState('');
	const [autoLock, setAutoLock] = useState(false);
	const [forceNewCluster, setForceNewCluster] = useState(false);
	const [joinAddresses, setJoinAddresses] = useState('');
	const [joinToken, setJoinToken] = useState('');
	const [joinListenAddress, setJoinListenAddress] = useState('');
	const [joinAdvertiseAddress, setJoinAdvertiseAddress] = useState('');
	const [runningAction, setRunningAction] = useState<'init' | 'join'>();
	const [errorMessage, setErrorMessage] = useState<string>();

	const remoteAddresses = joinAddresses
		.split(',')
		.map((address) => address.trim())
		.filter((address) => address !== '');

	const initialize = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setRunningAction('init');
		setErrorMessage(undefined);
		try {
			await client.swarm.initSwarm({
				request: {
					listenAddr: optionalTrimmed(listenAddress),
					advertiseAddr: optionalTrimmed(advertiseAddress),
					forceNewCluster: forceNewCluster ? true : undefined,
					spec: {},
					autoLockManagers: autoLock ? true : undefined
				},
				envID: environmentID
			});
			swarmChanged(environmentID);
			showToast(Toasts.success('Swarm initialized'));
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setRunningAction(undefined);
		}
	};

	const join = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setRunningAction('join');
		setErrorMessage(undefined);
		try {
			await client.swarm.join({
				request: {
					listenAddr: optionalTrimmed(joinListenAddress),
					advertiseAddr: optionalTrimmed(joinAdvertiseAddress),
					remoteAddrs: remoteAddresses,
					joinToken: joinToken.trim()
				},
				envID: environmentID
			});
			swarmChanged(environmentID);
			showToast(Toasts.success('Joined the swarm'));
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setRunningAction(undefined);
		}
	};

	return {
		canInitialize: can(Permission.Swarm.initialize),
		canJoin: can(Permission.Swarm.join),
		listenAddress,
		setListenAddress,
		advertiseAddress,
		setAdvertiseAddress,
		autoLock,
		setAutoLock,
		forceNewCluster,
		setForceNewCluster,
		joinAddresses,
		setJoinAddresses,
		joinToken,
		setJoinToken,
		joinListenAddress,
		setJoinListenAddress,
		joinAdvertiseAddress,
		setJoinAdvertiseAddress,
		runningAction,
		errorMessage,
		isBusy: runningAction !== undefined,
		canSubmitJoin: remoteAddresses.length > 0 && joinToken.trim() !== '',
		initialize: () => void initialize(),
		join: () => void join()
	};
}

export type SwarmSetupModel = ReturnType<typeof useSwarmSetup>;
