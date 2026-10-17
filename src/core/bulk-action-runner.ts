export interface BulkResult {
	succeeded: number;
	failed: { id: string; error: unknown }[];
}

export const BulkActionRunner = {
	async run(ids: readonly string[], operation: (id: string) => Promise<void>): Promise<BulkResult> {
		let succeeded = 0;
		const failed: BulkResult['failed'] = [];
		for (const id of ids) {
			try {
				await operation(id);
				succeeded += 1;
			} catch (error) {
				failed.push({ id, error });
			}
		}
		return { succeeded, failed };
	}
} as const;
