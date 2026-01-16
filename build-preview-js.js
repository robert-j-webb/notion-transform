import * as esbuild from "esbuild";

// Config output
const BUILD_DIRECTORY = "dist";

// Config entrypoint files
const ENTRY_POINTS = ["./blog-preview-notion.js"];

// Create context
const context = await esbuild.context({
  bundle: true,
  entryPoints: ENTRY_POINTS,
  outdir: BUILD_DIRECTORY,
  minify: true,
  sourcemap: false,
  target: "es2022",
});

await context.rebuild();
context.dispose();
