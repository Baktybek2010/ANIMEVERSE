import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";

const TYPES: Record<string, string> = { ".webm": "video/webm", ".vtt": "text/vtt", ".mp4": "video/mp4" };
let server: Server | undefined;

/** Локальный сервер тестовых медиафайлов с CORS и поддержкой Range-запросов. */
export function startMediaServer(root: string, port: number): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    server = createServer((request, response) => {
      const path = normalize(decodeURIComponent((request.url ?? "/").split("?")[0])).replace(/^(\.\.[/\\])+/, "");
      const file = join(root, path);
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader("Accept-Ranges", "bytes");
      if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
        response.writeHead(404).end();
        return;
      }
      const size = statSync(file).size;
      const type = TYPES[extname(file)] ?? "application/octet-stream";
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? "");
      if (range) {
        const start = range[1] ? Number(range[1]) : 0;
        const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
        response.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
        createReadStream(file, { start, end }).pipe(response);
      } else {
        response.writeHead(200, { "Content-Type": type, "Content-Length": size });
        createReadStream(file).pipe(response);
      }
    });
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolvePromise());
  });
}

export function stopMediaServer(): Promise<void> {
  return new Promise((resolvePromise) => (server ? server.close(() => resolvePromise()) : resolvePromise()));
}
