import { ConnectionProfilesScreen } from '@/features/connection-profiles/connection-profiles-screen';

/** Account → Connection Profiles: a push in the current tab's stack (ProfileView.swift `NavigationLink`). */
export default function Route() {
	return <ConnectionProfilesScreen pushed />;
}
