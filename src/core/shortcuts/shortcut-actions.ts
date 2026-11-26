import { randomUUID } from 'expo-crypto';

import { useAppLock } from '@/core/app-lock/app-lock-store';
import { Keys, storage } from '@/core/storage';
import { performListAction } from '@/features/containers/container-actions';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentsStore } from '@/stores/environments-store';
import { useProjectDeploymentStore } from '@/stores/project-deployment-store';
import { showToast, Toasts } from '@/ui/toast';

import type { ShortcutLink } from './shortcut-links';

type RunLink = Extract<ShortcutLink, { type: 'run' }>;

export function shortcutToken(): string {
	const existing = storage.string(Keys.shortcutToken);
	if (existing) return existing;
	const token = randomUUID();
	storage.set(Keys.shortcutToken, token);
	return token;
}

export function isTrustedShortcut(link: RunLink): boolean {
	const token = storage.string(Keys.shortcutToken);
	return token !== undefined && token !== '' && link.token === token;
}

const projectSuccess = { restart: 'Project restarted', down: 'Project stopped' } as const;
const projectFailure = {
	restart: "Couldn't restart project",
	down: "Couldn't stop project"
} as const;

async function runProject(link: Extract<RunLink, { kind: 'project' }>) {
	const environmentName =
		useEnvironmentsStore.getState().displayName(link.environmentID) ?? link.environmentID;
	if (link.action === 'up' || link.action === 'redeploy') {
		useProjectDeploymentStore.getState().start({
			kind: link.action,
			envID: link.environmentID,
			targetID: link.id,
			targetName: link.name,
			environmentName
		});
		return;
	}
	const client = useClientManager.getState().client;
	if (!client) return;
	const args = { envID: link.environmentID, projectID: link.id };
	const action = link.action;
	const request = action === 'restart' ? client.projects.restart(args) : client.projects.down(args);
	await request.then(
		() => showToast(Toasts.success(projectSuccess[action])),
		() => showToast(Toasts.error(projectFailure[action]))
	);
}

function run(link: RunLink) {
	if (link.kind === 'container') void performListAction(link.action, link.environmentID, link.id);
	else void runProject(link);
}

let pending: RunLink | undefined;
let unsubscribe: (() => void) | undefined;

function isReady(): boolean {
	return (
		useClientManager.getState().authState === 'authenticated' && !useAppLock.getState().isLocked
	);
}

function flushPending() {
	if (!pending || !isReady()) return;
	const link = pending;
	pending = undefined;
	unsubscribe?.();
	unsubscribe = undefined;
	run(link);
}

export function enqueueShortcutAction(link: RunLink) {
	if (!isTrustedShortcut(link)) {
		showToast(Toasts.error("Couldn't verify this shortcut."));
		return;
	}
	pending = link;
	if (isReady()) {
		flushPending();
		return;
	}
	if (unsubscribe) return;
	const offClient = useClientManager.subscribe(flushPending);
	const offLock = useAppLock.subscribe(flushPending);
	unsubscribe = () => {
		offClient();
		offLock();
	};
}
