import type { APIKey } from '@/sdk/models/apiKey/APIKey';
import type { User } from '@/sdk/models/user/User';

export type APIKeyRowProps = { apiKey: APIKey; assignedUser?: User };
