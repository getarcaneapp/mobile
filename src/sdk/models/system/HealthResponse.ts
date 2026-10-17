/** Port of Models/System/HealthResponse.swift. */

/** Health-check response. `status` is "UP" when healthy. */
export interface HealthResponse {
	status: string;
}
