import { cpSync, rmSync } from "node:fs";
import { SveltePlugin } from "bun-plugin-svelte";

const dist = "./dist";

// Clean
rmSync(dist, { recursive: true, force: true });

// Bundle the HTML entry point (Bun handles JS + CSS bundling from HTML)
const result = await Bun.build({
  entrypoints: ["./index.html"],
  outdir: dist,
  minify: true,
  sourcemap: "linked",
  plugins: [SveltePlugin({ development: false })],
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Copy public/ assets to dist/, excluding tiles (served from R2)
cpSync("./public", dist, { recursive: true });
rmSync(`${dist}/tiles`, { recursive: true, force: true });

console.log(`Build complete: ${result.outputs.length} outputs → ${dist}/`);
