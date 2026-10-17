export type EnvironmentID = string;

export const EnvironmentID = {
	localDocker: '0'
} as const satisfies Record<string, EnvironmentID>;

export interface RetryPolicy {
	maxAttempts: number;
	baseBackoffMs: number;
	maxBackoffMs: number;
}

export const RetryPolicy = {
	make(maxAttempts: number, baseBackoffMs: number, maxBackoffMs: number): RetryPolicy {
		return { maxAttempts: Math.max(1, maxAttempts), baseBackoffMs, maxBackoffMs };
	},
	default: { maxAttempts: 3, baseBackoffMs: 150, maxBackoffMs: 2000 } as RetryPolicy
} as const;
