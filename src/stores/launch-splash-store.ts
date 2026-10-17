/**
 * `\.isLaunchSplashPresented` environment value from Arcane_MobileApp.swift:
 * whether the animated launch splash still covers the app.
 */
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
