import { cpSync, rmSync } from "node:fs";

const dist = "./dist";

// Clean
rmSync(dist, { recursive: true, force: true });

// Bundle the HTML entry point (Bun handles JS + CSS bundling from HTML)
const result = await Bun.build({
  entrypoints: ["./index.html"],
  outdir: dist,
  minify: true,
  sourcemap: "linked",
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Copy public/ assets to dist/
cpSync("./public", dist, { recursive: true });

console.log(`Build complete: ${result.outputs.length} outputs → ${dist}/`);
