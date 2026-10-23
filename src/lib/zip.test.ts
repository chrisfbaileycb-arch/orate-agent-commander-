import { describe, expect, it } from "vitest";
import { buildZip } from "./zip";
import type { GeneratedFile } from "./types";

const FILES: GeneratedFile[] = [
  { path: "README.md", language: "markdown", contents: "# Gym\n\nBooks classes fast." },
  { path: "server/routes.py", language: "python", contents: "def index():\n    return 'ok'\n" },
  { path: "schema.sql", language: "sql", contents: "CREATE TABLE members (id INTEGER PRIMARY KEY);" },
];

describe("deterministic ZIP sealer", () => {
  it("produces a zip-shaped payload with an end-of-central-directory record", async () => {
    const blob = buildZip(FILES);
    const text = await blob.text();
    // Local file header signatures (PK\x03\x04)
    const headerCount = (text.match(/PK\x03\x04/g) ?? []).length;
    expect(headerCount).toBe(FILES.length);
    // End-of-central-directory (PK\x05\x06)
    expect(text).toContain("PK\x05\x06");
  });

  it("is byte-for-byte deterministic for identical inputs", async () => {
    const [a, b] = await Promise.all([buildZip(FILES).text(), buildZip(FILES).text()]);
    expect(b).toBe(a);
    // And an intentionally different file yields a different archive.
    const other: GeneratedFile[] = [{ ...FILES[0], contents: "different" }];
    expect(await buildZip(other).text()).not.toBe(a);
  });

  it("preserves non-ascii names and content via UTF-8", async () => {
    const files: GeneratedFile[] = [
      { path: "docs/résumé.md", language: "markdown", contents: "café — β" },
    ];
    const blob = buildZip(files);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // Local header signature PK\x03\x04, then little-endian flags at bytes 6..7
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
    // UTF-8 name flag (general purpose bit 11) → 0x0800 little-endian
    expect(bytes[6]).toBe(0x00);
    expect(bytes[7]).toBe(0x08);
    // Raw size covers name + UTF-8 content
    expect(blob.size).toBeGreaterThan(40);
  });

  it("handles an empty file list (bare end record)", async () => {
    const blob = buildZip([]);
    expect(blob.size).toBe(22);
    expect(await blob.text()).toContain("PK\x05\x06");
  });
});
