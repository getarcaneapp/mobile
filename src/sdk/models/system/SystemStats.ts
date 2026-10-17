/** Port of Models/System/SystemStats.swift. */

/** Resource statistics for a single GPU. */
export interface GPUStats {
	name: string;
	index: number;
	memoryUsed: number;
	memoryTotal: number;
}

/**
 * System resource statistics for WebSocket streaming over
 * `/environments/{id}/ws/system/stats`.
 */
export interface SystemStats {
	cpuUsage: number;
	memoryUsage: number;
	memoryTotal: number;
	diskUsage?: number;
	diskTotal?: number;
	cpuCount: number;
	architecture: string;
	platform: string;
	hostname?: string;
	gpuCount: number;
	gpus?: GPUStats[];
}
