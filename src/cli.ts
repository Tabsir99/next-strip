#!/usr/bin/env node

/**
 * next-strip CLI
 * Post-process Next.js builds to selectively remove unnecessary JavaScript
 */

import { Command } from "commander";
import chalk from "chalk";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { existsSync } from "node:fs";
import { dehydrate } from "./index.js";
import type { DehydrateConfig } from "./types.js";

// Package version (will be updated during build)
const VERSION = "1.0.0";

// MIME types for the preview server
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "font/otf",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".pdf": "application/pdf",
};

/**
 * Print the banner
 */
function printBanner(): void {
  console.log("");
  console.log(chalk.bold("  next-strip"));
  console.log(
    chalk.dim("  Post-process Next.js builds for progressive enhancement"),
  );
  console.log("");
}

/**
 * Create and run the CLI
 */
async function main(): Promise<void> {
  const program = new Command();

  program
    .name("next-strip")
    .description(
      "Post-process Next.js builds to selectively remove unnecessary JavaScript",
    )
    .version(VERSION)

    .option("-s, --serve", "Start a local preview server after processing")
    .option("-p, --port <port>", "Port for the preview server", "3000")
    .option("-v, --verbose", "Enable verbose logging")
    .action(async (options) => {
      printBanner();

      const config: DehydrateConfig = {
        verbose: options.verbose ?? false,
        serve: options.serve ?? false,
        port: parseInt(options.port, 10) || 3000,
      };

      try {
        await dehydrate(config);

        // Start preview server if requested
        if (config.serve) {
          await startPreviewServer(config);
        }
      } catch (error) {
        console.error("");
        console.error(
          chalk.red("Error:"),
          error instanceof Error ? error.message : String(error),
        );
        console.error("");

        if (config.verbose && error instanceof Error && error.stack) {
          console.error(chalk.dim(error.stack));
        }

        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

/**
 * Start a simple preview server
 */
async function startPreviewServer(config: DehydrateConfig): Promise<void> {
  // Determine the directory to serve
  const serveDir = existsSync("out") ? "out" : ".next";

  console.log(chalk.dim(`Starting preview server...`));
  console.log("");

  const server = createServer(async (req, res) => {
    let urlPath = req.url ?? "/";

    // Remove query string
    const queryIndex = urlPath.indexOf("?");
    if (queryIndex !== -1) {
      urlPath = urlPath.substring(0, queryIndex);
    }

    // Default to index.html
    if (urlPath === "/") {
      urlPath = "/index.html";
    }

    // Try to find the file
    let filePath = join(serveDir, urlPath);

    // If no extension, try adding .html
    if (!extname(filePath)) {
      const htmlPath = `${filePath}.html`;
      if (existsSync(htmlPath)) {
        filePath = htmlPath;
      } else {
        // Try index.html in directory
        const indexPath = join(filePath, "index.html");
        if (existsSync(indexPath)) {
          filePath = indexPath;
        }
      }
    }

    // Check if file exists
    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        throw new Error("Not a file");
      }

      const content = await readFile(filePath);
      const ext = extname(filePath);
      const mimeType = MIME_TYPES[ext] ?? "application/octet-stream";

      res.writeHead(200, { "Content-Type": mimeType });
      res.end(content);
    } catch {
      // 404
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

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("");
    console.log(chalk.dim("  Shutting down..."));
    server.close(() => {
      process.exit(0);
    });
  });

  // Keep the process running
  await new Promise(() => {});
}

// Run the CLI
main().catch((error) => {
  console.error(chalk.red("Unexpected error:"), error);
  process.exit(1);
});
