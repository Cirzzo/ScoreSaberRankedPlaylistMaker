// Bundles src/main.ts -> dist/app.js and copies everything in public/ to dist/.
// `node build.mjs`        production build
// `node build.mjs --dev`  watch + local server at http://localhost:8000
import * as esbuild from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const dev = process.argv.includes("--dev");

const options = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "dist/app.js",
  format: "iife",
  target: "es2022",
  sourcemap: dev,
  minify: !dev,
  logLevel: "info",
};

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });

if (dev) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: "dist", port: 8000 });
  console.log(
    `Dev server: http://localhost:${port} (restart to pick up changes in public/)`,
  );
} else {
  await esbuild.build(options);
}
