# Нүдний гэрэл — brand artwork (#142)

The team-approved name is **Нүдний гэрэл**, matching the web demo and Home screen.
The user confirmed the team lead approved #142 before implementation.

## Source and licence

Original vector artwork created for PineQuest Team 2 in this change with Codex assistance.
It uses simple eye/circle primitives and the existing app palette (`theme.ts`), with the
same eye/light-reflex motif as Home's `EyeHero`. No stock artwork, traced reference image,
photograph, person, font or external logo is embedded.

The SVGs, export script and PNGs derived from them are licensed under the adjacent
[MIT licence](LICENSE). This licence applies to these new assets, not to unrelated files.
The existing Expo attribution in `apps/mobile/LICENSE` remains intact.

- `mark.svg`: transparent colour mark for splash; no text or pre-rounded icon corners.
- `icon.svg`: opaque square app icon with a pale blue halo.
- `android-foreground.svg`: transparent mark at 76% scale; visible artwork fits inside the
  central 66/108-diameter adaptive-icon safe circle.
- `android-monochrome.svg`: white alpha mask for Android themed icons, with a reflex cutout.

## Raster exports

Export with Node and Sharp 0.34.5 (an artwork tool only; no app dependency is added):

```sh
npm install --prefix /tmp/pinequest-art-tools --no-audit --no-fund sharp@0.34.5
NODE_PATH=/tmp/pinequest-art-tools/node_modules node apps/mobile/assets/branding/export.cjs /tmp/pinequest-brand
```

The script requires an explicit output folder; it never overwrites app assets by default.
It writes a 1024px RGB icon (no alpha channel), 64px RGB favicon, and 1024px transparent
adaptive foreground, monochrome mask and splash mark. The platform/configuration PRs copy
only their respective exports into `apps/mobile/assets/`.

Preview sheets are design/asset previews, not iPhone screenshots. An installed build is
required to verify the actual home-screen label, icon mask and native splash.
