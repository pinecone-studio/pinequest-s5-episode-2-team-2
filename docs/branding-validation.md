# Branding validation (#142)

The team approved **Нүдний гэрэл**. Original artwork, editable SVG sources, the raster
export command and the asset-only MIT licence are in
[assets/branding](../apps/mobile/assets/branding/README.md).

## Checked locally

- iOS prebuild writes `CFBundleDisplayName = Нүдний гэрэл` and selects a 1024×1024 RGB
  app icon without an alpha channel.
- Android prebuild writes the same name, `#F3F7FF` icon background, adaptive foreground
  and monochrome resources. Visible artwork fits the central safe circle.
- The web favicon is 64×64 RGB; all platform PNGs match the SVG exports.
- The Expo SDK's bundled version map selects `expo-splash-screen ~58.0.11`. Its config
  plugin creates a centred 240pt `SplashScreenLogo` with `scaleAspectFit` in the iOS
  launch storyboard and `#F3F7FF` on both platforms.
- No extra launch timer or JavaScript splash route is introduced. Expo Router retains
  its existing loading/splash lifecycle.

The committed PNG preview shows artwork/generated resource layout, **not an iPhone screenshot**.
Generated `ios/` and `android/` projects remain ignored; regenerate them from app.json.

## Device acceptance still pending

Physical-device discovery timed out and CoreSimulatorService refused the connection in
this session. No successful install, iPhone home-screen screenshot or native cold-launch
capture was obtained. Do not mark those #142 acceptance checks done based on asset
previews, prebuild output or a Metro export.

With the project dependencies and native signing set up, verify on the team's iPhone:

```sh
cd apps/mobile
npx expo run:ios --device --configuration Release
```

Confirm the installed name/icon and cold-launch splash before closing #142. Preserve
existing user data when rebuilding. Keep slug, bundle/package identifiers and URL scheme.

Expo recommends a preview/production build for splash verification: Expo Go and development
builds can display their own launch UI. See the official
[splash-screen guide](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/).

Android prebuild also reports the existing `expo-system-ui`/`userInterfaceStyle` warning;
that module is outside this branding change. Generated launcher/splash resources were
checked, but actual Android launcher/theme appearance remains a device check.
