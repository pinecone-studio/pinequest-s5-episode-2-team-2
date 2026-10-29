import { inflateSync } from "node:zlib";
import { crc32, rgbPngUri } from "./png";

function decode(uri: string) {
  expect(uri.startsWith("data:image/png;base64,")).toBe(true);
  const png = Buffer.from(uri.slice("data:image/png;base64,".length), "base64");
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks: { type: string; data: Buffer }[] = [];
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at);
    const type = png.toString("latin1", at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + length);
    expect(png.readUInt32BE(at + 8 + length)).toBe(crc32(png.subarray(at + 4, at + 8 + length)));
    chunks.push({ type, data });
    at += 12 + length;
  }
  return chunks;
}

test("crc32 matches the standard check value", () => {
  expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  expect(crc32(new TextEncoder().encode("IEND"))).toBe(0xae426082);
});

test.each([
  [2, 1],
  [128, 128],
  // More than 65535 bytes of scanlines needs several stored blocks.
  [160, 160],
])("a %i × %i RGB image round-trips through a standard PNG decoder", (width, height) => {
  const rgb = new Uint8Array(width * height * 3).map((_, i) => (i * 7) % 256);
  const chunks = decode(rgbPngUri(width, height, rgb));
  expect(chunks.map((c) => c.type)).toEqual(["IHDR", "IDAT", "IEND"]);
  const header = chunks[0]!.data;
  expect([header.readUInt32BE(0), header.readUInt32BE(4), ...header.subarray(8)]).toEqual([
    width,
    height,
    8,
    2,
    0,
    0,
    0,
  ]);
  const raw = inflateSync(chunks[1]!.data);
  expect(raw).toHaveLength(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const row = raw.subarray(y * (1 + width * 3), (y + 1) * (1 + width * 3));
    expect(row[0]).toBe(0);
    expect(
      row.subarray(1).equals(Buffer.from(rgb.subarray(y * width * 3, (y + 1) * width * 3))),
    ).toBe(true);
  }
});

test("rejects pixel data of the wrong size", () => {
  expect(() => rgbPngUri(2, 2, new Uint8Array(3))).toThrow("RGB size does not match the image");
});
