import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import type { Readable } from "node:stream";

/** Create a scratch dir and guarantee cleanup even if the callback throws. */
export async function withTmpDir<T>(
  fn: (dir: string) => Promise<T>
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "rotation-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function streamToFile(
  stream: Readable,
  path: string
): Promise<void> {
  await pipeline(stream, createWriteStream(path));
}

export async function bufferToFile(buf: Buffer, path: string): Promise<void> {
  await writeFile(path, buf);
}

export { join as joinPath };
