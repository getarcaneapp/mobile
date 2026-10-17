import { create } from 'zustand';

import { friendlyErrorMessage } from '@/core/errors';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import { environmentDisplayName } from '@/stores/environments-store';
import { showToast, Toasts } from '@/ui/toast';
import { systemColors } from '@/theme/colors';

export type EnvironmentOperationResult = {
	id: string;
	name: string;
	status: string;
	failed: boolean;
	finished: boolean;
};

type Operation = (environmentID: string) => Promise<string>;

type AllEnvironmentsOperationState = {
	results: EnvironmentOperationResult[];
	isRunning: boolean;
	run: (
		environments: Environment[],
		isCurrent: () => boolean,
		operation: Operation
	) => Promise<void>;
	runWithToast: (args: {
		title: string;
		completionTitle?: string;
		symbol?: string;
		isDestructive?: boolean;
		environments: Environment[];
		isCurrent: () => boolean;
		operation: Operation;
	}) => Promise<void>;
};

export const useAllEnvironmentsOperationStore = create<AllEnvironmentsOperationState>(
	(set, get) => {
		const updateResult = (index: number, patch: Partial<EnvironmentOperationResult>) =>
			set((s) => ({
				results: s.results.map((result, i) => (i === index ? { ...result, ...patch } : result))
			}));

		return {
			results: [],
			isRunning: false,

			run: async (environments, isCurrent, operation) => {
				if (get().isRunning || get().results.length > 0) return;
				const results = environments
					.filter((e) => e.enabled)
					.map((e) => ({
						id: e.id,
						name: environmentDisplayName(e),
						status: '',
						failed: false,
						finished: false
					}));
				set({ results, isRunning: true });
				try {
					for (let index = 0; index < results.length; index++) {
						if (!isCurrent()) {
							set((s) => ({
								results: s.results.map((result, i) =>
									i >= index
										? {
												...result,
												status: 'Not started: connection changed or operation cancelled',
												failed: true,
												finished: true
											}
										: result
								)
							}));
							return;
						}
						updateResult(index, { status: 'Running…' });
						try {
							const status = await operation(results[index]!.id);
							updateResult(index, { status });
						} catch (error) {
							updateResult(index, { status: friendlyErrorMessage(error), failed: true });
						}
						updateResult(index, { finished: true });
					}
				} finally {
					set({ isRunning: false });
				}
			},

			runWithToast: async ({
				title,
				completionTitle,
				symbol = 'arrow.triangle.2.circlepath',
				isDestructive = false,
				environments,
				isCurrent,
				operation
			}) => {
				if (get().isRunning) {
					showToast(Toasts.info('An action is already running.'));
					return;
				}
				if (!environments.some((e) => e.enabled)) {
					showToast(Toasts.info('No enabled environments.'));
					return;
				}
				set({ results: [] });
				showToast({
					...Toasts.info(title),
					duration: 2.5,
					symbol,
					symbolTint: isDestructive ? systemColors.red : undefined,
					isPersistent: true
				});
				await get().run(environments, isCurrent, operation);
				const results = get().results;
				const failed = results.filter((r) => r.failed).length;
				const succeeded = results.filter((r) => r.finished && !r.failed).length;
				const message =
					failed === 0
						? (completionTitle ?? `${title} complete`)
						: `${succeeded} succeeded, ${failed} failed`;
				showToast(failed === 0 ? Toasts.success(message) : Toasts.error(message));
			}
		};
	}
);
