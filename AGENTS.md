# AGENTS.md

Guidance for AI agents and new contributors working on Arcane Mobile: the Expo / React Native client for the [Arcane](https://github.com/getarcaneapp) Docker management platform, shipping on iOS and Android.

## Golden rules

1. **iOS is native SwiftUI; Android is Material 3.** Both platforms get the same features and flows, each in its own platform's design language. Never dress Android in iOS chrome or the reverse.
2. **Every user-facing change goes in `src/release-notes.ts`** under the entry whose `version` matches `MARKETING_VERSION` in `app.config.ts` (prepend the entry if it's missing): `new:`, `changed:`, `removed:` or `fixed:`. Bullets are terse one-liners that state the change. No explanations, no "now", no comparisons.
3. **Never `git commit` or `git push`.** The user handles git.
4. **No code comments** of any kind (line, block, doc or JSX). Tool directives (`// oxlint-disable-next-line`, `// @ts-expect-error`) are the only exception.
5. **`ios/` and `android/` are generated** by `expo prebuild`. Never edit them; configure native behavior in `app.config.ts` and config plugins (`plugins/`, `modules/*/plugin/`).
6. **TypeScript only.** `.ts`/`.tsx`, and `.mts` for Node scripts in `scripts/`. Config plugins are `.ts`.
7. **`pnpm check` and `pnpm test` must pass with zero errors and warnings** before work is done.
8. **iOS delivery is a Sqim real-device Release build** after every completed change:
   1. Run `pnpm ios:prepare` whenever dependencies or `app.config.ts` changed.
   2. From `ios/`: `sqim status`, then `sqim upload --device --build --workspace Arcane.xcworkspace --scheme Arcane --configuration Release`. A Debug build boots the dev-client launcher and needs Metro, so it's useless on a phone away from the dev machine.
   3. Give the user the final HTTPS install URL. Never use simulator uploads or `sqim remote-build`. Retry with `--allow-provisioning-updates` only for missing profiles; never revoke or create signing certificates without approval. If the build or upload fails, report it and never hand over an older link.

## Toolchain

- **pnpm only.** `nodeLinker: hoisted` keeps a flat `node_modules` for autolinking and Metro.
- **Vite+ (`vp`)** runs format (Oxfmt), lint (Oxlint), type check and tests (Vitest, `src/**/__tests__/*.test.ts`, importing from `vite-plus/test`). Metro bundles the app.
- **Style:** tabs, single quotes, no trailing commas, width 100. Run `pnpm fmt`; don't hand-format.
- **Dependencies:** Expo SDK packages (and `react`, `react-native`, etc.) stay on what `pnpm expo install --check` reports; add them with `pnpm expo install`. Everything else stays on its latest release.

## Project layout

```
src/
├── app/                 # Expo Router routes only: each file re-exports a feature screen
│   └── (tabs)/(dashboard,…,more)/   # every destination, shared by all tab stacks
├── features/<domain>/   # screens + hooks: Screen.ios.tsx (SwiftUI), Screen.android.tsx, use-*.ts shared
├── sdk/                 # Arcane API client (see src/sdk/README.md)
├── stores/              # zustand stores
├── core/                # storage, auth, networking, formatting helpers
├── theme/               # colors, Radius/Motion tokens, accent color
├── ui/                  # shared components (see src/ui/components/README.md)
└── release-notes.ts     # rendered by What's New; update with every change
```

## Architecture & conventions

### Platform splits

- `Foo.ios.tsx` / `Foo.android.tsx` live outside `src/app/`; shared props go in `Foo.types.ts`. Data loading lives in a shared `use*` hook so both platforms behave the same.
- Unsuffixed files load on iOS too, so they must never import Android-only modules (`@react-native-menu/menu`, `@expo/ui/jetpack-compose`); that red-boxes on iOS.
- `.ios.tsx` files with no Android sibling (`swiftui-motion`, `swiftui-surfaces`, `*-swiftui`) may only be imported from other `.ios.tsx` files.

### iOS UI

- Real SwiftUI through `@expo/ui/swift-ui`. Wrap each tree in `Host` from `@/ui/host`, never `@expo/ui`: it applies the accent as the tint.
- Headers use `Stack.Screen` options and `AppToolbar` from `@/ui/app-toolbar`.

### Android UI

- React Native views styled as Material 3 (`src/ui/material/`, colors from `src/theme/colors.ts`, `android_ripple`), plus `@expo/ui/jetpack-compose` for native controls (Switch, DropdownMenu, AlertDialog, ModalBottomSheet, SegmentedButton, Slider).
- Icons via `src/ui/Icon.tsx`. Map every new SF Symbol to a Material Symbol in `src/ui/symbols.ts`.

### State, storage, SDK

- Subscribe to stores with narrow selectors (`useStore((s) => s.field)`, or `useShallow` for derived arrays/objects); never call a store hook with no selector.
- Persistence is MMKV via `src/core/storage.ts` (`useStoredString`, `useStoredBool`, `Keys`). Never rename an existing storage key. Secrets go in `expo-secure-store`.
- Support both Arcane v1 and v2 backends; gate v2-only features on capability checks (e.g. `supportsActivities`).
- Transient feedback uses `showToast(Toasts.*)` from `src/ui/toast`, never `Alert`.

### Copy

- No filler captions or subtitles. Projects are "Projects", never "stacks".

### Performance

- **Long lists are virtualized.** On iOS use `List.ForEach data keyExtractor estimatedItemSize` (or `StableSectionedList`). On Android use `VirtualizedSectionedList` / `GroupedFlashList` (FlashList), with load-more driven by `onEndReached`. Never `.map()` an unbounded list into a `List` or `ScrollView`.
- Recycled rows are reused for other items: row-local state (useState, shared values, native state) must reset when the item's identity changes, or a recycled row animates as if its value changed.
- Live data (streams, polls) should re-render only the leaf that shows it: subscribe per row or per card, keep unchanged objects identical, and skip `set()` when nothing changed.
- Animations run on the UI thread with Reanimated or SwiftUI modifiers. No `requestAnimationFrame` + `setState` loops.

### React Compiler

- Every component and hook must compile. The compiler silently skips functions that use `try/finally`, `try/catch` around conditionals or `throw`, `for await`, `??=`, `++` on module variables, ref reads or writes during render, `.value =` on shared values or native state (use `.set()`), or an `eslint-disable` for hook rules. Use `withCleanup` / `nextInstanceKey` from `src/core/with-cleanup.ts`, module-level async functions, `useState(() => …)` and `useEffectEvent`.
- Compiled render code is cached on its inputs, so reading global state during render goes stale. Use `usePermission` / `usePermissionCheck` instead of `hasPermission`, and selectors instead of `getState()` or `storage.*`. Reads inside event handlers, callbacks and effects are fine.

### `@expo/ui` and Hermes pitfalls

- `systemColors` resolve per read for the current appearance and iOS version; read them during render, never in module constants.
- Import `Image` from `@/ui/components/swiftui-image`, not `@expo/ui/swift-ui`, which forces `font(size: 24)` and breaks inherited symbol sizes.
- `strokeBorder` on a shape still fills it: put `foregroundStyle("#00000000")` first and pass `shape` / `cornerRadius`.
- `ContentUnavailableView` with action buttons is `UnavailableView` from `@/ui/components/unavailable-view`.
- `Toolbar.Content` in sheets draws items that share a placement in reverse declaration order.
- A `buttonStyle("plain")` row only takes taps on opaque content: give its HStack `contentShape(shapes.rectangle())`.
- `foregroundStyle("tertiary" | "quaternary")` is dropped. Use `{ type: "hierarchical", style }` for these, for `"secondary"` (the plain string is the bluish `Color.secondary`), and for `"primary"` inside Button labels.
- A state-driven `<Alert isPresented>` needs `<AlertAnchor />` as its first child and must sit beside the `List`/`Form` inside the `Host`.
- Nested `<Text>` runs don't re-render reliably; build changing strings as one `Text`.
- `RNHostView` needs a fixed SwiftUI `frame` around a `matchContents` host.
- Hermes has no `Intl.RelativeTimeFormat`: use `relativeTimeFormat()` from `@/core/relative-time`. Cache `Intl.DateTimeFormat` / `Intl.Collator` instances instead of calling `toLocale*String` with options per row.
- Models with a `decode` function (e.g. `DockerInfo.decode`) must be decoded when fetching through `boundedDirectResponse`; raw JSON silently yields zeros.
- iOS caches the launch screen per bundle ID; restart the device to see a change.

### Beta releases

- `.github/workflows/beta.yml` builds on Depot runners with `eas build --local` (iOS on `depot-macos-26`, Android on Linux); builds never run on EAS servers. Pushes to `main` submit with the `internal` profile (TestFlight internal testers, Play internal testing). Public TestFlight and Play closed or production releases are done by hand.
- Build numbers are automatic: `app.config.ts` sets iOS `buildNumber` and Android `versionCode` to minutes since 2020-01-01 UTC (CI pins one value per job via `ARCANE_BUILD_NUMBER`). Never set them by hand.
- Signing credentials and store API keys live in EAS; CI only needs `EXPO_TOKEN`.

### Versioning

- `MARKETING_VERSION` is at the top of `app.config.ts`; release-note entries key off it.
- iOS bundle ID `com.getarcaneapp.ios.mobile` and Android package `app.getarcane.android` continue the existing App Store Connect and Play Console apps, so build numbers must stay above their last uploads (iOS `2672336` from Xcode Cloud); the minutes-based scheme already does.

## Workflow checklist for any change

1. Make the change following the conventions above, on both platforms.
2. Add a bullet to `src/release-notes.ts` for anything user-facing.
3. `pnpm fmt`, then `pnpm check` and `pnpm test`.
4. Deliver the Sqim real-device Release build and give the install URL.
5. Do not commit; the user handles git.
