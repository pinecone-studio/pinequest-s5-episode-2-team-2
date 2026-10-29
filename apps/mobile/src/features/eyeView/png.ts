// A minimal PNG writer for the in-memory eye photos on the result screen (#274): 8-bit RGB,
// deflate "stored" blocks, so no zlib or image library is needed for 128 × 128 crops.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]!) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out +=
      BASE64[(n >> 18) & 63]! +
      BASE64[(n >> 12) & 63]! +
      (i + 1 < bytes.length ? BASE64[(n >> 6) & 63]! : "=") +
      (i + 2 < bytes.length ? BASE64[n & 63]! : "=");
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** An RGB image (0..255, row by row) as a `data:image/png;base64,…` URI. */
export function rgbPngUri(width: number, height: number, rgb: Uint8Array): string {
  if (rgb.length !== width * height * 3) throw new Error("RGB size does not match the image");
  // Each row starts with filter type 0 (none).
  const raw = new Uint8Array(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (1 + width * 3) + 1);
  }
  const blocks = Math.max(1, Math.ceil(raw.length / 65535));
  const zlib = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  zlib[0] = 0x78;
  zlib[1] = 0x01;
  let at = 2;
  for (let start = 0, block = 0; block < blocks; block++, start += 65535) {
    const length = Math.min(65535, raw.length - start);
    zlib[at] = block === blocks - 1 ? 1 : 0;
    zlib[at + 1] = length & 0xff;
    zlib[at + 2] = length >> 8;
    zlib[at + 3] = ~length & 0xff;
    zlib[at + 4] = (~length >> 8) & 0xff;
    zlib.set(raw.subarray(start, start + length), at + 5);
    at += 5 + length;
  }
  new DataView(zlib.buffer).setUint32(at, adler32(raw));

  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 2, 0, 0, 0], 8);
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib),
    chunk("IEND", new Uint8Array(0)),
  ];
  const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return `data:image/png;base64,${base64(png)}`;
}
