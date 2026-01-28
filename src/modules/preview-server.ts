import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { existsSync } from "node:fs";
import chalk from "chalk";
import type { DehydrateConfig } from "../types.js";
import { MIME_TYPES } from "../constants.js";

export async function startPreviewServer(config: DehydrateConfig): Promise<void> {
  const serveDir = existsSync("out") ? "out" : ".next";

  console.log(chalk.dim(`Starting preview server...`));
  console.log("");

  const server = createServer(async (req, res) => {
    const urlPath = sanitizeUrlPath(req.url ?? "/");
    const filePath = resolveFilePath(urlPath, serveDir);

    try {
      await serveFile(filePath, res);
    } catch {
      serve404(urlPath, res);
    }
  });

  server.listen(config.port, () => {
    console.log(
      chalk.green("  Preview server running at:"),
      chalk.cyan(`http://localhost:${config.port}`),
    );
    console.log("");
    console.log(chalk.dim("  Press Ctrl+C to stop"));
    console.log("");
  });

  setupGracefulShutdown(server);

  await new Promise(() => {});
}

function sanitizeUrlPath(url: string): string {
  let urlPath = url;

  const queryIndex = urlPath.indexOf("?");
  if (queryIndex !== -1) {
    urlPath = urlPath.substring(0, queryIndex);
  }

  if (urlPath === "/") {
    urlPath = "/index.html";
  }

  return urlPath;
}

function resolveFilePath(urlPath: string, serveDir: string): string {
  let filePath = join(serveDir, urlPath);

  if (!extname(filePath)) {
    const htmlPath = `${filePath}.html`;
    if (existsSync(htmlPath)) {
      return htmlPath;
    }

    const indexPath = join(filePath, "index.html");
    if (existsSync(indexPath)) {
      return indexPath;
    }
  }

  return filePath;
}

async function serveFile(
  filePath: string,
  res: import("http").ServerResponse,
): Promise<void> {
  const fileStat = await stat(filePath);

  if (!fileStat.isFile()) {
    throw new Error("Not a file");
  }

  const content = await readFile(filePath);
  const ext = extname(filePath);
  const mimeType = MIME_TYPES[ext] ?? "application/octet-stream";

  res.writeHead(200, { "Content-Type": mimeType });
  res.end(content);
}

function serve404(
  urlPath: string,
  res: import("http").ServerResponse,
): void {
  res.writeHead(404, { "Content-Type": "text/html" });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head><title>404 Not Found</title></head>
      <body>
        <h1>404 Not Found</h1>
        <p>The requested URL ${urlPath} was not found.</p>
      </body>
    </html>
  `);
}

function setupGracefulShutdown(server: import("http").Server): void {
  process.on("SIGINT", () => {
    console.log("");
    console.log(chalk.dim("  Shutting down..."));
    server.close(() => {
      process.exit(0);
    });
  });
}
