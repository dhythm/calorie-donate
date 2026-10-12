import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { Buffer } from 'node:buffer';
import { log } from 'node:console';
import path from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'assets/brand/source');
const web = path.join(root, 'apps/web/public/brand');
const mobile = path.join(root, 'apps/mobile/assets/brand');
const yellow = '#f9bf13';

async function artwork(name) {
  const svg = await readFile(path.join(source, `${name}.svg`), 'utf8');
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1];
  const [, , width, height] = viewBox.split(' ').map(Number);
  const paths = svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
  return { viewBox, width, height, paths };
}

const wordmark = await artwork('wordmark');
const monogram = await artwork('monogram');

function compose(art, width, height, maxWidth, maxHeight, background, ink) {
  const scale = Math.min(maxWidth / art.width, maxHeight / art.height);
  const w = art.width * scale;
  const h = art.height * scale;
  const paths = ink ? art.paths.replaceAll('#000000', ink) : art.paths;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${background ? `<rect width="${width}" height="${height}" fill="${background}"/>` : ''}
<svg x="${(width - w) / 2}" y="${(height - h) / 2}" width="${w}" height="${h}" viewBox="${art.viewBox}">${paths}</svg>
</svg>\n`;
}

async function png(svg, filename, opaque = false) {
  let image = sharp(Buffer.from(svg));
  if (opaque) image = image.removeAlpha();
  await image.png().toFile(filename);
}

await mkdir(web, { recursive: true });
await mkdir(mobile, { recursive: true });
const logo = compose(wordmark, 1008, 288, 944, 224);
await writeFile(path.join(web, 'wordmark.svg'), logo);
for (const folder of [web, mobile]) {
  await png(logo, path.join(folder, 'wordmark.png'));
}
await png(
  compose(monogram, 1024, 1024, 690, 690, yellow),
  path.join(mobile, 'icon.png'),
  true,
);
// All foreground pixels stay inside Android's central circular safe area.
await png(
  compose(monogram, 1024, 1024, 540, 540),
  path.join(mobile, 'adaptive-foreground.png'),
);
await png(
  compose(monogram, 1024, 1024, 540, 540, undefined, '#ffffff'),
  path.join(mobile, 'adaptive-monochrome.png'),
);
await png(
  compose(monogram, 768, 768, 510, 510),
  path.join(mobile, 'splash-mark.png'),
);

for (const size of [180, 192, 512]) {
  const filename = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
  await png(
    compose(
      monogram,
      size,
      size,
      (size * 690) / 1024,
      (size * 690) / 1024,
      yellow,
    ),
    path.join(web, filename),
    true,
  );
}
await png(
  compose(monogram, 512, 512, 270, 270, yellow),
  path.join(web, 'icon-maskable-512.png'),
  true,
);
const favicon = compose(monogram, 256, 256, 194, 194, yellow);
await writeFile(path.join(web, 'favicon.svg'), favicon);
await png(
  compose(monogram, 32, 32, 24.25, 24.25, yellow),
  path.join(web, 'favicon-32.png'),
  true,
);

// ICO supports lossless PNG entries; provide several actual sizes for browsers.
const sizes = [16, 32, 48, 64];
const frames = await Promise.all(
  sizes.map((size) =>
    sharp(
      Buffer.from(
        compose(
          monogram,
          size,
          size,
          (size * 194) / 256,
          (size * 194) / 256,
          yellow,
        ),
      ),
    )
      .removeAlpha()
      .png()
      .toBuffer(),
  ),
);
const directory = Buffer.alloc(6 + 16 * frames.length);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(frames.length, 4);
let offset = directory.length;
frames.forEach((frame, index) => {
  const entry = 6 + index * 16;
  directory[entry] = sizes[index];
  directory[entry + 1] = sizes[index];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(frame.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
});
await writeFile(
  path.join(web, 'favicon.ico'),
  Buffer.concat([directory, ...frames]),
);
await png(
  compose(wordmark, 1200, 630, 960, 228, yellow),
  path.join(web, 'social-card.png'),
  true,
);

const manifest = {
  name: 'Calorie Donate',
  short_name: 'Calorie Donate',
  description: '目標を超えたカロリーを、世界の子どもたちへの寄付に。',
  lang: 'ja',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: yellow,
  theme_color: yellow,
  icons: [
    ...[192, 512].map((size) => ({
      src: `/brand/icon-${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: 'any',
    })),
    {
      src: '/brand/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};
await writeFile(
  path.join(web, '../manifest.webmanifest'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
log('Exported brand assets from the original Illustrator vector paths.');
