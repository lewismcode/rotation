/**
 * Local demo of the REAL render pipeline modules — no R2/DB/Clerk needed.
 * Generates a synthetic non-9:16 "raw clip", probes it, then for each hook:
 *   renderHookPng()  ->  compositeReel()   (the exact production code path)
 * Outputs sample .mp4s + the caption .png into an --out directory.
 *
 * Usage: tsx scripts/demo-render.mts --out /path/to/dir
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderHookPng } from "../apps/worker/src/overlay/renderHookPng.js";
import { compositeReel } from "../apps/worker/src/composite.js";
import { probeFile, ffmpeg } from "../apps/worker/src/ffmpeg.js";
import { outputFilename } from "../packages/shared/src/slug.js";

const HOOKS = [
  "wait for the drop 🔊",
  "POV: you found your new favorite artist",
  "nobody is talking about this song",
];

const outIdx = process.argv.indexOf("--out");
const OUT = outIdx >= 0 ? process.argv[outIdx + 1]! : "./demo-out";

// A 1280x720 landscape source (NOT 9:16) so the cover-crop path is exercised,
// with a moving pattern + a tone so there's real video + audio.
function makeSourceClip(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input("testsrc=size=1280x720:rate=30:duration=5")
      .inputOptions(["-f", "lavfi"])
      .input("sine=frequency=220:duration=5")
      .inputOptions(["-f", "lavfi"])
      .outputOptions(["-pix_fmt", "yuv420p", "-shortest"])
      .on("end", () => resolve())
      .on("error", reject)
      .save(path);
  });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const src = join(OUT, "_source_1280x720.mp4");

  console.log("→ generating synthetic raw clip (1280x720, landscape)…");
  await makeSourceClip(src);

  const probe = await probeFile(src);
  const aspect = probe.width / probe.height;
  const needsResize = Math.abs(aspect - 1080 / 1920) > 0.01;
  console.log(
    `→ probed: ${probe.width}x${probe.height}, ${probe.durationSeconds.toFixed(
      1
    )}s, needs_resize=${needsResize} (will center-crop to 1080x1920)`
  );

  const sourceName = "artist_take_01.mp4";
  for (const hook of HOOKS) {
    const outName = outputFilename(sourceName, hook);
    const pngPath = join(OUT, outName.replace(/\.mp4$/, ".caption.png"));
    const mp4Path = join(OUT, outName);

    console.log(`→ rendering caption + compositing: "${hook}"`);
    const png = renderHookPng(hook);
    await writeFile(pngPath, png);
    await compositeReel(src, pngPath, mp4Path);
  }

  console.log(`\n✓ done. Outputs in ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
