import { existsSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { BuildMode, type BuildDetectionResult } from "../types.js";
import { createLogger } from "../utils/logger.js";
import { DEFAULT_EXPORT_DIR, DEFAULT_BUILD_DIR, ROUTER_TYPES } from "../constants.js";

const logger = createLogger("build-detection");

export async function detectBuild(): Promise<BuildDetectionResult> {
  const projectDir = process.cwd();
  const outDir = join(projectDir, DEFAULT_EXPORT_DIR);
  const nextDir = join(projectDir, DEFAULT_BUILD_DIR);

  if (isValidDirectory(outDir)) {
    logger.verbose(`Found static export directory: ${outDir}`);
    return await analyzeBuildDirectory(outDir);
  }

  if (isValidDirectory(nextDir)) {
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

function isValidDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

function findRouterType(projectDir: string) {
  for (const candidate of ROUTER_TYPES) {
    const fullPath = join(projectDir, candidate.path);

    if (existsSync(fullPath)) {
      return {
        routesDir: fullPath,
        isAppRouter: candidate.routerType === "app",
        sourceRootDir:
          candidate.sourceRoot === "src" ? join(projectDir, "src") : projectDir,
      };
    }
  }

  throw new Error(
    "No Next.js router directory found. Expected 'app' or 'pages' directory.",
  );
}

async function analyzeBuildDirectory(
  dir: string,
): Promise<BuildDetectionResult> {
  const projectDir = process.cwd();
  const entries = await readdir(dir).catch(() => [] as string[]);

  const hasServerDir = entries.includes("server");
  const hasStaticDir = entries.includes("static");
  const hasBuildManifest = entries.includes("build-manifest.json");
  const hasIndexHtml = entries.includes("index.html");
  const hasNextStaticDir = entries.includes("_next");

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

export async function validateBuild(
  result: BuildDetectionResult,
): Promise<void> {
  if (!existsSync(result.htmlDir)) {
    throw new Error(`HTML directory not found: ${result.htmlDir}`);
  }

  if (result.mode === BuildMode.STANDARD_BUILD) {
    const manifestPath = join(result.buildDir, "build-manifest.json");
    if (!existsSync(manifestPath)) {
      throw new Error(`Required build file not found: ${manifestPath}`);
    }
  }
}

export function describeBuildMode(mode: BuildMode): string {
  return mode === BuildMode.STATIC_EXPORT
    ? "Static Export (out/)"
    : "Standard Build (.next/)";
}
