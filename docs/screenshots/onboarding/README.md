# Onboarding visual checks (#230)

- `iphone17-after-1.png` through `iphone17-after-4.png`: actual iPhone 17,
  iOS 27.0 Simulator, Release build, captured 2026-10-28. Cropped from the
  Device Hub window; the app screen itself is unmodified.
- `iphone17-home-after-consent.png`: Home after checking the consent box and
  accepting. The actual simulator SQLite database contained consent version `1`.
- `web-before-1.png` through `web-before-4.png`: the original onboarding component
  rendered with React Native Web at 375 × 667. These are **not simulator captures**.
  The preview uses stubbed routing and storage; consent persistence was checked
  separately on the native simulator and in the repository tests.

All four updated pages were also checked at 375 × 667 and 393 × 852 in the web
preview. Native iPhone SE-size validation and native before captures are still
pending: the automation's CoreSimulator service connection was refused, and the
Device Hub add-simulator control timed out. The iPhone 17 Release build and
interaction were completed through Xcode and Device Hub. Do not mark #230 fully
validated until the remaining native checks are recorded.

No app text, consent version, storage schema, Home artwork, or native bundle
identifier is changed by this PR. Screenshots use a simulator; no face/eye photos
or model weights are included.
