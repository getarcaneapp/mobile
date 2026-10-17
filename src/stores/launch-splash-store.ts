import { create } from 'zustand';

import { Keys, storage } from '@/core/storage';

type LaunchSplashState = {
	isPresented: boolean;
	dismiss: () => void;
};

export const useLaunchSplash = create<LaunchSplashState>((set) => ({
	isPresented: storage.bool(Keys.launchAnimationEnabled) ?? true,
	dismiss: () => set({ isPresented: false })
}));
