import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { adviceCards } from "./advice";

const directory = resolve(__dirname, "../../../assets/illustrations");
const provenance = JSON.parse(readFileSync(resolve(directory, "provenance.json"), "utf8")) as {
  owner: string;
  permission: string;
  files: {
    id: string;
    source: string;
    originalSha256: string;
    outputSha256: string;
    bytes: number;
    width: number;
    height: number;
  }[];
};

test("each advice topic has a traced, small PNG for offline use", () => {
  expect(provenance.owner).toBe("megnamigi");
  expect(provenance.permission).toContain("2026-10-29");
  expect(provenance.files.map((file) => file.id)).toEqual(adviceCards.map((card) => card.id));
  for (const file of provenance.files) {
    const data = readFileSync(resolve(directory, `${file.id}.png`));
    expect(data.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(data.length).toBeLessThan(150_000);
    expect(data.length).toBe(file.bytes);
    expect(data.readUInt32BE(16)).toBe(file.width);
    expect(data.readUInt32BE(20)).toBe(file.height);
    expect(file.width).toBeGreaterThanOrEqual(360);
    const expectedRatio = file.id === "outdoor-time" ? 4 / 3 : 9 / 16;
    expect(Math.abs(file.width / file.height - expectedRatio)).toBeLessThan(0.002);
    expect(createHash("sha256").update(data).digest("hex")).toBe(file.outputSha256);
    expect(file.originalSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(file.source).toMatch(/\.png$/);
  }
});
