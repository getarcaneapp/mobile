import { Circle, HStack, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityElement,
	accessibilityHidden,
	clipShape,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	resizable
} from '@expo/ui/swift-ui/modifiers';

import { useClientManager } from '@/stores/client-manager';
import { useAccentColor } from '@/theme/accent';
import { colorGradient } from '@/theme/colors';

/** Port of `UserAvatarCircle`. */
export function UserAvatarCircle({ size }: { size: number }) {
	const accent = useAccentColor();
	const user = useClientManager((s) => s.currentUser);
	const avatarURI = useClientManager((s) => s.currentUserAvatarURI);
	const source = user?.displayName ? user.displayName : (user?.username ?? '?');
	const initials = source.slice(0, 1).toUpperCase();

	if (avatarURI) {
		return (
			<Image
				uiImage={avatarURI}
				modifiers={[resizable(), frame({ width: size, height: size }), clipShape('circle')]}
			/>
		);
	}
	return (
		<ZStack>
			<Circle
				modifiers={[foregroundStyle(colorGradient(accent)), frame({ width: size, height: size })]}
			/>
			<Text
				modifiers={[font({ textStyle: 'subheadline', weight: 'bold' }), foregroundStyle('white')]}
			>
				{initials}
			</Text>
		</ZStack>
	);
}

/** Port of `UserAccountLabel`: signed-in identity used by rows that open Profile. */
export function UserAccountLabel({ avatarSize = 36 }: { avatarSize?: number }) {
	const user = useClientManager((s) => s.currentUser);
	const displayName = !user ? 'Account' : user.displayName ? user.displayName : user.username;
	const username = user?.username ? `@${user.username}` : 'Profile';
	return (
		<HStack spacing={12} modifiers={[accessibilityElement('combine')]}>
			<ZStack modifiers={[accessibilityHidden(true)]}>
				<UserAvatarCircle size={avatarSize} />
			</ZStack>
			<VStack alignment="leading" spacing={1}>
				<Text
					modifiers={[
						font({ textStyle: 'subheadline', weight: 'medium' }),
						lineLimit(1),
						foregroundStyle('primary')
					]}
				>
					{displayName}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						lineLimit(1)
					]}
				>
					{username}
				</Text>
			</VStack>
		</HStack>
	);
}
