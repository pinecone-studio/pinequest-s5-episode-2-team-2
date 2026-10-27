/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS artwork tool; Sharp is resolved through NODE_PATH, not an app dependency. */
// Rebuild the committed raster assets from the MIT-licensed SVG sources.
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const output = process.argv[2];
if (!output) throw new Error("Usage: node export.cjs /absolute/output/folder");
const assets = [
  ["icon.svg", "icon.png", 1024, true],
  ["icon.svg", "favicon.png", 64, true],
  ["android-foreground.svg", "android-icon-foreground.png", 1024, false],
  ["android-monochrome.svg", "android-icon-monochrome.png", 1024, false],
  ["mark.svg", "splash-icon.png", 1024, false],
];
(async () => {
  await fs.mkdir(output, { recursive: true });
  for (const [source, name, size, opaque] of assets) {
    let image = sharp(path.join(__dirname, source)).resize(size, size);
    if (opaque) image = image.flatten({ background: "#F3F7FF" }).removeAlpha();
    await image.png().toFile(path.join(output, name));
    console.log(name);
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
