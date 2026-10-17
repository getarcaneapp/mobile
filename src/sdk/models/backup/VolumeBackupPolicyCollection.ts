import { D } from '../base/decoding';
import { VolumeBackupPolicy } from './VolumeBackupPolicy';

export interface VolumeBackupPolicyCollection {
	policies: VolumeBackupPolicy[];
	s3Available: boolean;
}

export const VolumeBackupPolicyCollection = {
	decode(this: void, raw: unknown): VolumeBackupPolicyCollection {
		const o = D.object(raw, 'VolumeBackupPolicyCollection');
		return {
			policies: D.array(o, 'policies', VolumeBackupPolicy.decode),
			s3Available: D.boolean(o, 's3Available')
		};
	},
	encode(this: void, value: VolumeBackupPolicyCollection): Record<string, unknown> {
		return {
			policies: value.policies.map(VolumeBackupPolicy.encode),
			s3Available: value.s3Available
		};
	}
} as const;
