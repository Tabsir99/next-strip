import { existsSync } from "node:fs";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { glob } from "glob";
import { minify } from "html-minifier-terser";
import {
  type BuildDetectionResult,
  type PageAnalysis,
  type ProcessedPage,
} from "../types.js";
import { getProcessedHtml } from "./script-stripper.js";
import { getSpaRouterScript } from "./spa-router.js";
import { createLogger } from "../utils/logger.js";
import { MINIFY_OPTIONS } from "../constants.js";

const logger = createLogger("output");

export async function generateOutput(
  buildResult: BuildDetectionResult,
  analyses: PageAnalysis[],
): Promise<ProcessedPage[]> {
  const spaRouterScript = getSpaRouterScript();

  const processedPages = await Promise.all(
    analyses.map((analysis) => processAndWriteHtml(analysis, spaRouterScript)),
  );

  await writeSpaRouterFile(buildResult.buildDir, spaRouterScript);

  return processedPages;
}

async function processAndWriteHtml(
  analysis: PageAnalysis,
  spaRouterScript: string,
): Promise<ProcessedPage> {
  const result = await getProcessedHtml(analysis, spaRouterScript);

  await mkdir(dirname(analysis.absolutePath), { recursive: true });

  const minifiedHtml = await minify(result.html, MINIFY_OPTIONS);
  await writeFile(analysis.absolutePath, minifiedHtml, "utf-8");

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

async function writeSpaRouterFile(
  outputDir: string,
  script: string,
): Promise<void> {
  const routerDir = join(outputDir, "_next-strip");
  await mkdir(routerDir, { recursive: true });

  const routerPath = join(routerDir, "spa-nav.min.js");
  await writeFile(routerPath, script, "utf-8");

  logger.verbose(`Created SPA router: ${routerPath}`);
}

export async function findGeneratedPages(
  buildResult: BuildDetectionResult,
): Promise<{ html: string; sourceJsx: string }[]> {
  const { htmlDir, routesDir } = buildResult;

  const htmlFiles = await glob("**/*.html", {
    cwd: htmlDir,
    nodir: true,
    absolute: false,
  });

  const pages = await Promise.all(
    htmlFiles.map((htmlFile) =>
      findSourceForHtml(htmlFile, htmlDir, routesDir),
    ),
  );

  return pages.filter((page): page is { html: string; sourceJsx: string } =>
    Boolean(page.sourceJsx),
  );
}

async function findSourceForHtml(
  htmlFile: string,
  htmlDir: string,
  routesDir: string,
): Promise<{ html: string; sourceJsx: string }> {
  const route =
    htmlFile === "index.html" ? "" : htmlFile.replace(/\.html$/, "");

  const sourceCandidates = [
    join(routesDir, `${route || "index"}.tsx`),
    join(routesDir, `${route || "index"}.jsx`),
    join(routesDir, route, "page.tsx"),
    join(routesDir, route, "page.jsx"),
  ];

  for (const candidate of sourceCandidates) {
    if (existsSync(candidate)) {
      return {
        html: join(htmlDir, htmlFile),
        sourceJsx: candidate,
      };
    }
  }

  return {
    html: join(htmlDir, htmlFile),
    sourceJsx: "",
  };
}
