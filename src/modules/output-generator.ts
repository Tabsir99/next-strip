/**
 * Output Generator Module
 * Handles copying and generating the output directory structure
 */

import { existsSync } from "node:fs";
import { mkdir, copyFile, writeFile, stat } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { glob } from "glob";
import {
  BuildMode,
  type BuildDetectionResult,
  type PageAnalysis,
  type ProcessedPage,
} from "../types.js";
import { getProcessedHtml } from "./script-stripper.js";
import { getSpaRouterScript } from "./spa-router.js";
import { createLogger } from "../utils/logger.js";
import { minify } from "html-minifier-terser";
const logger = createLogger("output");

/**
 * Generate the output directory with processed files
 */
export async function generateOutput(
  buildResult: BuildDetectionResult,
  analyses: PageAnalysis[],
): Promise<ProcessedPage[]> {
  const spaRouterScript = getSpaRouterScript();
  const processedPages: ProcessedPage[] = [];
  const outputDir = buildResult.buildDir;

  // Process HTML files
  for (const analysis of analyses) {
    const processed = await processAndWriteHtml(analysis, spaRouterScript);
    processedPages.push(processed);
  }

  // Copy assets based on build mode
  await copyAssets(buildResult, outputDir);

  // Generate SPA router file
  await writeSpaRouterFile(outputDir, spaRouterScript);

  return processedPages;
}

/**
 * Process an HTML file and write to output
 */
async function processAndWriteHtml(
  analysis: PageAnalysis,
  spaRouterScript: string,
): Promise<ProcessedPage> {
  // Get processed HTML
  const result = await getProcessedHtml(analysis, spaRouterScript);

  // Ensure directory exists
  await mkdir(dirname(analysis.absolutePath), { recursive: true });

  // Write the processed HTML
  await writeFile(
    analysis.absolutePath,
    await minify(result.html, {
      minifyCSS: true,
      minifyJS: true,
      removeComments: true,
      collapseWhitespace: true,
      removeEmptyAttributes: true,
    }),
    "utf-8",
  );

  const newStats = await stat(analysis.absolutePath);

  logger.verbose(
    `Processed: ${analysis.absolutePath} ` +
      `(${result.scriptsRemoved} scripts, ${result.preloadsRemoved} preloads)`,
  );

  return {
    analysis,
    newSize: newStats.size,
    scriptsRemoved: result.scriptsRemoved,
    preloadsRemoved: result.preloadsRemoved,
    routerInjected: result.routerInjected,
  };
}

/**
 * Copy assets to output directory
 */
async function copyAssets(
  buildResult: BuildDetectionResult,
  outputDir: string,
): Promise<void> {
  if (buildResult.mode === BuildMode.STANDARD_BUILD) {
    // For standard builds, assets are already in place
    logger.verbose("Standard build: assets already in place");
    return;
  }

  // For static exports, copy all non-HTML files
  logger.verbose("Copying assets...");

  const allFiles = await glob("**/*", {
    cwd: buildResult.buildDir,
    nodir: true,
    dot: false,
  });

  let copiedCount = 0;

  for (const file of allFiles) {
    const ext = extname(file).toLowerCase();

    // Skip HTML files (they're processed separately)
    if (ext === ".html") continue;

    // Skip JS files that were part of Next.js runtime
    if (ext === ".js" && file.includes("_next/static/chunks")) {
      // Keep CSS and other assets in _next/static
      continue;
    }

    const srcPath = join(buildResult.buildDir, file);
    const destPath = join(outputDir, file);

    // Check if source exists
    if (!existsSync(srcPath)) continue;

    const srcStats = await stat(srcPath);
    if (!srcStats.isFile()) continue;

    // Create destination directory
    await mkdir(dirname(destPath), { recursive: true });

    // Copy the file
    await copyFile(srcPath, destPath);
    copiedCount++;
  }

  logger.verbose(`Copied ${copiedCount} asset files`);
}

/**
 * Write the SPA router script file
 */
async function writeSpaRouterFile(
  outputDir: string,
  script: string,
): Promise<void> {
  // For now, the router is inlined in HTML files
  // This function creates a standalone file for reference/debugging

  const routerDir = join(outputDir, "_next-strip");
  await mkdir(routerDir, { recursive: true });

  const routerPath = join(routerDir, "spa-nav.min.js");
  await writeFile(routerPath, script, "utf-8");

  logger.verbose(`Created SPA router: ${routerPath}`);
}

/**
 * Find all HTML files and their source JSX/TSX files
 */
export async function findGeneratedPages(
  buildResult: BuildDetectionResult,
): Promise<{ html: string; sourceJsx: string }[]> {
  const { htmlDir, routesDir } = buildResult;

  const htmlFiles = await glob("**/*.html", {
    cwd: htmlDir,
    nodir: true,
    absolute: false,
  });

  const results = await Promise.all(
    htmlFiles.map(async (htmlFile) => {
      const route =
        htmlFile === "index.html" ? "" : htmlFile.replace(/\.html$/, "");

      const sourceCandidates = [
        join(routesDir, `${route || "index"}.jsx`),
        join(routesDir, route, "page.jsx"),
        join(routesDir, `${route || "index"}.tsx`),
        join(routesDir, route, "page.tsx"),
      ];

      for (const candidate of sourceCandidates) {
        if (existsSync(candidate)) {
          return {
            html: join(htmlDir, htmlFile),
            sourceJsx: candidate,
          };
        }
      }

      return { html: htmlFile, sourceJsx: "" };
    }),
  );

  return results.filter((r) => r.sourceJsx && r.html);
}
