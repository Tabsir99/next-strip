/**
 * Build detection module
 * Detects whether we're working with a static export or standard Next.js build
 */

import { existsSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path, { join, resolve } from "node:path";
import { BuildMode, type BuildDetectionResult } from "../types.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("build-detection");

/**
 * Default directories to check for builds
 */
const DEFAULT_EXPORT_DIR = "out";
const DEFAULT_BUILD_DIR = ".next";

/**
 * Detect the build mode and return relevant paths
 */
export async function detectBuild(): Promise<BuildDetectionResult> {
  const projectDir = process.cwd();

  // Auto-detect: prefer out/ if it exists, otherwise check .next/
  const outDir = join(projectDir, DEFAULT_EXPORT_DIR);
  const nextDir = join(projectDir, DEFAULT_BUILD_DIR);

  if (existsSync(outDir) && statSync(outDir).isDirectory()) {
    logger.verbose(`Found static export directory: ${outDir}`);
    return await analyzeBuildDirectory(outDir);
  }

  if (existsSync(nextDir) && statSync(nextDir).isDirectory()) {
    logger.verbose(`Found Next.js build directory: ${nextDir}`);
    return await analyzeBuildDirectory(nextDir);
  }

  throw new Error(
    `No Next.js build found. Expected either:\n` +
      `  - Static export: ${outDir}\n` +
      `  - Standard build: ${nextDir}\n\n` +
      `Run 'next build' or 'next build && next export' first.`,
  );
}

function findRouterType(projectDir: string) {
  const candidates = [
    { path: "src/app", routerType: "app", sourceRoot: "src" },
    { path: "src/pages", routerType: "pages", sourceRoot: "src" },
    { path: "app", routerType: "app", sourceRoot: "." },
    { path: "pages", routerType: "pages", sourceRoot: "." },
  ] as const;

  for (const c of candidates) {
    const fullPath = join(projectDir, c.path);

    if (existsSync(fullPath)) {
      return {
        routesDir: fullPath,
        isAppRouter: c.routerType === "app",
        sourceRootDir:
          c.sourceRoot === "src" ? join(projectDir, "src") : projectDir,
      };
    }
  }

  throw new Error("No router type found");
}

/**
 * Analyze a directory to determine build mode and paths
 */
async function analyzeBuildDirectory(
  dir: string,
): Promise<BuildDetectionResult> {
  const projectDir = process.cwd();

  const entries: string[] = await readdir(dir).catch(() => [] as string[]);

  // Check for .next build structure
  const hasServerDir = entries.includes("server");
  const hasStaticDir = entries.includes("static");
  const hasBuildManifest = entries.includes("build-manifest.json");

  // Check for static export structure (has index.html at root or in subdirs)
  const hasIndexHtml = entries.includes("index.html");
  const hasNextStaticDir = entries.includes("_next");

  // Determine if this is a static export or standard build
  const isStaticExport = hasIndexHtml || (hasNextStaticDir && !hasServerDir);
  const isStandardBuild = hasServerDir && hasStaticDir && hasBuildManifest;

  const { isAppRouter, routesDir, sourceRootDir } = findRouterType(projectDir);

  if (isStandardBuild) {
    return {
      mode: BuildMode.STANDARD_BUILD,
      buildDir: dir,
      htmlDir: isAppRouter
        ? join(dir, "server", "app")
        : join(dir, "server", "pages"),
      assetsDir: join(dir, "static"),
      routesDir,
      sourceRootDir,
    };
  }

  if (isStaticExport) {
    return {
      mode: BuildMode.STATIC_EXPORT,
      buildDir: dir,
      htmlDir: dir,
      assetsDir: hasNextStaticDir ? join(dir, "_next", "static") : dir,
      routesDir,
      sourceRootDir,
    };
  }

  throw new Error(
    `Could not determine build mode for directory: ${dir}\n` +
      `The directory does not appear to contain a valid Next.js build.`,
  );
}

/**
 * Validate that the build directory is accessible and contains expected files
 */
export async function validateBuild(
  result: BuildDetectionResult,
): Promise<void> {
  // Check that HTML directory exists
  if (!existsSync(result.htmlDir)) {
    throw new Error(`HTML directory not found: ${result.htmlDir}`);
  }

  // For standard builds, verify the structure
  if (result.mode === BuildMode.STANDARD_BUILD) {
    const requiredFiles = ["build-manifest.json"];

    for (const file of requiredFiles) {
      const filePath = join(result.buildDir, file);
      if (!existsSync(filePath)) {
        throw new Error(`Required build file not found: ${filePath}`);
      }
    }
  }
}

/**
 * Get a human-readable description of the build mode
 */
export function describeBuildMode(mode: BuildMode): string {
  switch (mode) {
    case BuildMode.STATIC_EXPORT:
      return "Static Export (out/)";
    case BuildMode.STANDARD_BUILD:
      return "Standard Build (.next/)";
  }
}
