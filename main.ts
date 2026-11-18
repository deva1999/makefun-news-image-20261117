// Entry program for make.fun news-image-20261117.
// Copies the bundled front-page image (entry.png) to the output
// directory, after gate-checking it the way the competition's own
// gate does: PNG signature, dimensions within 1024x1024, at most
// 1 MiB. The write is atomic (temp file + rename) and the SHA-256
// of the written file must match the source, so both grader runs
// produce exactly the same bytes.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_BYTES = 1048576;
const MAX_DIMENSION = 1024;

function fail(message: string): never {
  console.error("entry failed: " + message);
  process.exit(1);
}

function sha256Hex(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function readPngDimensions(data: Buffer): { width: number; height: number } {
  if (data.length < 24 || !data.subarray(0, 8).equals(PNG_SIGNATURE)) {
    fail("entry.png is not a PNG file (bad signature)");
  }
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  return { width, height };
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const sourcePath = join(here, "entry.png");
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  const outPath = join(outDir, "entry.png");

  const data = readFileSync(sourcePath);
  if (data.length > MAX_BYTES) {
    fail(`entry.png is ${data.length} bytes, over the 1048576-byte cap`);
  }
  const { width, height } = readPngDimensions(data);
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    fail(`entry.png is ${width}x${height}, over the 1024x1024 cap`);
  }

  const sourceHash = sha256Hex(data);
  mkdirSync(outDir, { recursive: true });
  // The temp file lives in the output directory itself, so the rename
  // never crosses filesystems (a temp file in os.tmpdir() fails with
  // EXDEV when /output is a separate mount, as the grader's is).
  const tempPath = join(outDir, `.entry-${process.pid}.tmp.png`);
  try {
    writeFileSync(tempPath, data);
    renameSync(tempPath, outPath);
  } catch (error) {
    rmSync(tempPath, { force: true });
    fail(`could not write ${outPath}: ${(error as Error).message}`);
  }

  const written = readFileSync(outPath);
  if (sha256Hex(written) !== sourceHash) {
    fail("written entry.png does not match the source SHA-256");
  }
  const size = statSync(outPath).size;
  console.log(`wrote ${outPath} (${width}x${height}, ${size} bytes, sha256 ${sourceHash})`);
}

main();
