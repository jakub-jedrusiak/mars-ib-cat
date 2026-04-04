// @ts-nocheck
import { readdir } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const rootDir = import.meta.dir.includes("/scripts")
  ? resolve(import.meta.dir, "..")
  : import.meta.dir;

const publicDir = resolve(rootDir, "public");
const imagesDir = resolve(publicDir, "images");
const entrypoint = resolve(rootDir, "src/index.ts");
const htmlTemplatePath = resolve(publicDir, "index.html");
const outputDir = resolve(rootDir, "dist");
const outputPath = resolve(outputDir, "mars.html");

const mimeByExt: Record<string, string> = {
  ".avif": "image/avif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

async function walk(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function toPublicPath(absPath: string): string {
  return `/${relative(publicDir, absPath).replaceAll("\\", "/")}`;
}

async function buildScriptBundle(): Promise<string> {
  const build = await Bun.build({
    entrypoints: [entrypoint],
    write: false,
    minify: true,
    target: "browser",
    format: "esm",
  });

  if (!build.success) {
    const message = build.logs.map((log) => log.message).join("\n");
    throw new Error(message || "JS bundle build failed");
  }

  return await build.outputs[0].text();
}

async function buildAssetMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const files = await walk(imagesDir);

  for (const filePath of files) {
    const ext = extname(filePath).toLowerCase();
    const mimeType = mimeByExt[ext];
    if (!mimeType) continue;

    const bytes = await Bun.file(filePath).arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const publicPath = toPublicPath(filePath);
    map[publicPath] = `data:${mimeType};base64,${base64}`;
  }

  return map;
}

function minifyHtml(html: string): string {
  // Remove comments
  let minified = html.replace(/<!--[\s\S]*?-->/g, "");

  // Remove newlines and tabs, but preserve needed spaces
  minified = minified.replace(/>\s+</g, "><");
  minified = minified.replace(/\s+/g, " ");

  // Remove spaces before closing tags and after opening tags
  minified = minified.replace(/>\s+/g, ">");
  minified = minified.replace(/\s+</g, "<");

  return minified.trim();
}

function injectIntoHtml(
  template: string,
  assetMap: Record<string, string>,
  bundledJs: string,
): string {
  const withoutExternalModule = template.replace(
    /<script\s+type="module"\s+src="\/src\/index\.js"><\/script>/,
    "",
  );

  const sanitizeInlineScriptPayload = (content: string) =>
    content.replaceAll("</script", "<\\/script").replaceAll("<!--", "<\\!--");

  const assetPayload = sanitizeInlineScriptPayload(JSON.stringify(assetMap));
  const jsPayload = sanitizeInlineScriptPayload(bundledJs);

  const assetScript = `<script>window.__MARS_ASSETS__=${assetPayload};<\/script>`;
  const appScript = `<script type="module">${jsPayload}<\/script>`;

  return withoutExternalModule.replace(
    "</body>",
    () => `${assetScript}${appScript}</body>`,
  );
}

async function main() {
  const [template, bundledJs, assetMap] = await Promise.all([
    Bun.file(htmlTemplatePath).text(),
    buildScriptBundle(),
    buildAssetMap(),
  ]);

  let singleHtml = injectIntoHtml(template, assetMap, bundledJs);
  singleHtml = minifyHtml(singleHtml);
  await Bun.write(outputPath, singleHtml);

  console.log(`Single-file bundle generated: ${outputPath}`);
  console.log(`Embedded assets: ${Object.keys(assetMap).length}`);
}

await main();
