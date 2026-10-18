import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import { Permission } from '@/sdk/models/role/Permission';
import type { SwarmInfo } from '@/sdk/models/swarm/SwarmInfo';
import type { SwarmJoinTokens } from '@/sdk/models/swarm/SwarmJoinTokens';
import { useClientManager } from '@/stores/client-manager';
import {
	useDeleteConfirmation,
	useItemDeleteConfirmation
} from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import { useTabRouter } from '@/features/networks/tab-routes';

import { capitalized, swarmChanged, swarmDate, useCan } from './swarm-common';

type TokenRole = 'worker' | 'manager';

export function useSwarmCluster() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const environmentID = envID;
	const nav = useTabRouter();
	const can = useCan(environmentID);
	const client = useClientManager((s) => s.client);
	const [info, setInfo] = useState<SwarmInfo>();
	const [tokens, setTokens] = useState<SwarmJoinTokens>();
	const [unlockKey, setUnlockKey] = useState<string>();
	const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
	const [errorMessage, setErrorMessage] = useState<string>();
	const [pendingRotation, setPendingRotation] = useState<TokenRole>();
	const [showLeave, setShowLeave] = useState(false);
	const [showUnlock, setShowUnlock] = useState(false);
	const [unlockInput, setUnlockInput] = useState('');
	const [isWorking, setIsWorking] = useState(false);
	const canUnlock = can(Permission.Swarm.unlock);
	const canLeave = can(Permission.Swarm.leave);

	const load = useCallback(async () => {
		const current = useClientManager.getState().client;
		if (!current) return;
		try {
			setInfo(await current.swarm.info({ envID: environmentID }));
			if (canUnlock) setTokens(await current.swarm.joinTokens({ envID: environmentID }));
			setErrorMessage(undefined);
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		}
	}, [environmentID, canUnlock]);

	useEffect(() => {
		void load();
	}, [load, client]);

	const toggleRevealed = (title: string) =>
		setRevealed((current) => {
			const next = new Set(current);
			if (next.has(title)) next.delete(title);
			else next.add(title);
			return next;
		});

	const loadUnlockKey = async () => {
		const current = useClientManager.getState().client;
		if (!current) return;
		try {
			const response = await current.swarm.unlockKey({ envID: environmentID });
			setUnlockKey(response.unlockKey);
			setRevealed((r) => new Set([...r, 'Unlock Key']));
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		}
	};

	const rotate = async (role: TokenRole) => {
		const current = useClientManager.getState().client;
		if (!current) return;
		try {
			await current.swarm.rotateJoinTokens({
				request: { rotateWorkerToken: role === 'worker', rotateManagerToken: role === 'manager' },
				envID: environmentID
			});
			setTokens(await current.swarm.joinTokens({ envID: environmentID }));
			showToast(Toasts.success(`${capitalized(role)} token rotated`));
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		}
	};

	const unlock = async () => {
		const current = useClientManager.getState().client;
		if (!current) return;
		const key = unlockInput.trim();
		if (key === '') return;
		try {
			await current.swarm.unlock({ key, envID: environmentID });
			swarmChanged(environmentID);
			showToast(Toasts.success('Swarm unlocked'));
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		}
	};

	const leave = async (force: boolean) => {
		const current = useClientManager.getState().client;
		if (!current) return;
		setIsWorking(true);
		await withCleanup(
			async () => {
				try {
					await current.swarm.leave({ force, envID: environmentID });
					swarmChanged(environmentID);
					showToast(Toasts.success('Left the swarm'));
				} catch (error) {
					showToast(Toasts.error(friendlyErrorMessage(error)));
				}
			},
			() => setIsWorking(false)
		);
	};

	useItemDeleteConfirmation(pendingRotation, setPendingRotation, (role) => ({
		title: `Rotate ${capitalized(role)} Token`,
		message: `The current ${role} token stops working. Nodes already in the swarm aren't affected.`,
		icon: 'arrow.triangle.2.circlepath',
		actions: [{ title: 'Rotate', action: () => void rotate(role) }],
		dismissOnConfirm: false
	}));

	useDeleteConfirmation(showLeave, setShowLeave, {
		title: 'Leave Swarm',
		message:
			'A manager must be forced to leave, which can break quorum for the rest of the cluster.',
		icon: 'rectangle.portrait.and.arrow.right',
		actions: [
			{ title: 'Leave', action: () => void leave(false) },
			{ title: 'Force Leave', action: () => void leave(true) }
		]
	});

	return {
		info,
		tokens,
		unlockKey,
		revealed,
		errorMessage,
		isWorking,
		canUnlock,
		canLeave,
		load,
		createdText: info ? swarmDate(info.createdAt) : '',
		updatedText: info ? swarmDate(info.updatedAt) : '',
		toggleRevealed,
		loadUnlockKey: () => void loadUnlockKey(),
		requestRotation: (role: TokenRole) => setPendingRotation(role),
		requestLeave: () => setShowLeave(true),
		showUnlock,
		setShowUnlock,
		unlockInput,
		setUnlockInput,
		beginUnlock: () => {
			setUnlockInput('');
			setShowUnlock(true);
		},
		commitUnlock: () => {
			setShowUnlock(false);
			void unlock();
		},
		back: nav.back
	};
}

export type SwarmClusterModel = ReturnType<typeof useSwarmCluster>;

export const maskedToken = '•'.repeat(24);
