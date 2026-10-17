/**
 * Ports of `UserAvatarCircle` (synced profile picture, else accent initials
 * circle) and `UserAccountLabel` (avatar + display name + @username) for
 * Android.
 *
 * Standalone (RN views).
 */
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { useClientManager } from '@/stores/client-manager';
import { useAccentColor } from '@/theme/accent';
import { colors } from '@/theme/colors';

import { m3Type } from './type-scale';

export function UserAvatarCircle({ size }: { size: number }) {
	const accent = useAccentColor();
	const user = useClientManager((s) => s.currentUser);
	const avatarURI = useClientManager((s) => s.currentUserAvatarURI);
	const source = user?.displayName ? user.displayName : (user?.username ?? '?');
	if (avatarURI) {
		return (
			<Image
				source={{ uri: avatarURI }}
				contentFit="cover"
				style={{ width: size, height: size, borderRadius: size / 2 }}
			/>
		);
	}
	return (
		<View
			style={{
				width: size,
				height: size,
				borderRadius: size / 2,
				backgroundColor: accent,
				alignItems: 'center',
				justifyContent: 'center'
			}}
		>
			<Text style={{ color: '#FFFFFF', fontSize: size * 0.42, fontWeight: '700' }}>
				{source.slice(0, 1).toUpperCase()}
			</Text>
		</View>
	);
}

export function UserAccountLabel({ avatarSize = 36 }: { avatarSize?: number }) {
	const user = useClientManager((s) => s.currentUser);
	const displayName = !user ? 'Account' : user.displayName ? user.displayName : user.username;
	const username = user?.username ? `@${user.username}` : 'Profile';
	return (
		<View
			accessible
			accessibilityLabel={`${displayName}, ${username}`}
			style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
		>
			<UserAvatarCircle size={avatarSize} />
			<View style={{ flex: 1, gap: 1 }}>
				<Text numberOfLines={1} style={[m3Type.titleSmall, { color: colors.label }]}>
					{displayName}
				</Text>
				<Text numberOfLines={1} style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
					{username}
				</Text>
			</View>
		</View>
	);
}
