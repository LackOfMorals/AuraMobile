// Compares two PNG screenshots pixel by pixel, with no dependencies (node:zlib only). Reads the 8-bit, non-interlaced RGB and
// RGBA PNGs that `xcrun simctl io screenshot` writes.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export function decodePng(file) {
  const data = readFileSync(file);
  let pos = 8;
  let width = 0, height = 0, depth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos < data.length) {
    const length = data.readUInt32BE(pos);
    const type = data.toString('ascii', pos + 4, pos + 8);
    const body = data.subarray(pos + 8, pos + 8 + length);
    pos += 12 + length;
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      colorType = body[9];
      interlace = body[12];
    } else if (type === 'IDAT') {
      idat.push(body);
    }
  }
  const channels = { 2: 3, 6: 4 }[colorType];
  if (depth !== 8 || interlace !== 0 || !channels) throw new Error(`${file}: unsupported PNG (depth ${depth}, colour type ${colorType}, interlace ${interlace})`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const out = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? pixels[out + x - channels] : 0;
      const b = y > 0 ? pixels[out - stride + x] : 0;
      const c = x >= channels && y > 0 ? pixels[out - stride + x - channels] : 0;
      let v = raw[src + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      pixels[out + x] = v & 255;
    }
  }
  return { width, height, channels, pixels };
}

/**
 * How different two screenshots are: the number of pixels that differ at all, and the largest difference in any colour channel (0 to 255).
 * Screenshots of a different size are entirely different.
 */
export function diffPng(fileA, fileB) {
  const a = decodePng(fileA);
  const b = decodePng(fileB);
  if (a.width !== b.width || a.height !== b.height || a.channels !== b.channels) return { differing: Infinity, maxChannel: 255, total: a.width * a.height };
  let differing = 0, maxChannel = 0;
  for (let i = 0; i < a.pixels.length; i += a.channels) {
    let pixelDiffers = false;
    for (let k = 0; k < a.channels; k++) {
      const d = Math.abs(a.pixels[i + k] - b.pixels[i + k]);
      if (d > 0) { pixelDiffers = true; if (d > maxChannel) maxChannel = d; }
    }
    if (pixelDiffers) differing++;
  }
  return { differing, maxChannel, total: a.width * a.height };
}

/** Rendering noise, like the blur behind the Back button, is under a tenth of a percent of the pixels and a few colour levels. */
export const NOISE = { maxFraction: 0.001, maxChannel: 3 };
export const isNoise = d => d.differing === 0 || (d.differing / d.total <= NOISE.maxFraction && d.maxChannel <= NOISE.maxChannel);
