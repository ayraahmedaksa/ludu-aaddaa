// Rasterises the app artwork into Android launcher icons.
// Requires the `sharp` package:  npm install --no-save sharp
// Then run from this folder:     node make-icons.mjs
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRes = path.join(here, "..", "app", "res");
const sourceIcon = path.join(here, "..", "..", "assets", "app-icon.svg");
const foregroundIcon = path.join(here, "icon-foreground.svg");

const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const adaptive = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

for (const [density, size] of Object.entries(legacy)) {
  const dir = path.join(appRes, `mipmap-${density}`);
  await mkdir(dir, { recursive: true });
  const png = await sharp(sourceIcon).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
  const circle = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
  );
  const round = await sharp(png)
    .composite([{ input: circle, blend: "dest-in" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  await sharp(png).toFile(path.join(dir, "ic_launcher.png"));
  await sharp(round).toFile(path.join(dir, "ic_launcher_round.png"));
}

for (const [density, size] of Object.entries(adaptive)) {
  const dir = path.join(appRes, `mipmap-${density}`);
  await mkdir(dir, { recursive: true });
  await sharp(foregroundIcon)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(path.join(dir, "ic_launcher_foreground.png"));
}

console.log("Launcher icons written to", appRes);
