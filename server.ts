import { join, resolve } from "node:path";

const rootDir = import.meta.dir;
const publicDir = resolve(rootDir, "public");
const entrypoint = resolve(rootDir, "src/index.ts");

async function buildApp() {
  const build = await Bun.build({
    entrypoints: [entrypoint],
    write: false,
  });

  if (!build.success) {
    const message = build.logs.map((log) => log.message).join("\n");
    return new Response(message || "Build failed", { status: 500 });
  }

  return new Response(await build.outputs[0].text(), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function serveStatic(pathname: string) {
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = resolve(publicDir, relativePath);

  if (!filePath.startsWith(publicDir)) {
    return new Response("Not found", { status: 404 });
  }

  const file = Bun.file(filePath);
  return file.size > 0
    ? new Response(file)
    : new Response("Not found", { status: 404 });
}

Bun.serve({
  port: 3000,
  async fetch(request) {
    const pathname = new URL(request.url).pathname;

    if (pathname === "/src/index.js") {
      return buildApp();
    }

    return serveStatic(pathname);
  },
});

console.log("Server running at http://localhost:3000");
