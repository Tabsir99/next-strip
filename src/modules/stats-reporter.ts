/**
 * Statistics Reporter Module
 * Generates and displays statistics about the dehydration process
 */

import chalk from "chalk";
import {
  PageClassification,
  type DehydrateStats,
  type ProcessedPage,
} from "../types.js";
import { formatBytes, formatDuration, formatPercent } from "../utils/logger.js";
import { basename } from "node:path";

/**
 * Calculate statistics from processed pages
 */
export function calculateStats(
  pages: ProcessedPage[],
  startTime: number,
): DehydrateStats {
  const endTime = Date.now();

  const byClassification: Record<PageClassification, number> = {
    [PageClassification.PURE_STATIC]: 0,
    [PageClassification.ROUTING_ONLY]: 0,
    [PageClassification.INTERACTIVE]: 0,
  };

  let totalOriginalSize = 0;
  let totalNewSize = 0;
  let totalScriptsRemoved = 0;
  let totalPreloadsRemoved = 0;
  let pagesWithRouter = 0;

  for (const page of pages) {
    byClassification[page.analysis.classification]++;
    totalOriginalSize += page.analysis.originalSize;
    totalNewSize += page.newSize;
    totalScriptsRemoved += page.scriptsRemoved;
    totalPreloadsRemoved += page.preloadsRemoved;
    if (page.routerInjected) {
      pagesWithRouter++;
    }
  }

  return {
    totalPages: pages.length,
    byClassification,
    totalOriginalSize,
    totalNewSize,
    totalScriptsRemoved,
    totalPreloadsRemoved,
    pagesWithRouter,
    processingTime: endTime - startTime,
    pages,
  };
}

/**
 * Print a summary of the dehydration statistics
 */
export function printStats(stats: DehydrateStats): void {
  const separator = chalk.dim("─".repeat(50));

  console.log("");
  console.log(separator);
  console.log(chalk.bold("  Dehydration Summary"));
  console.log(separator);
  console.log("");

  // Page classification breakdown
  console.log(chalk.dim("  Page Classification:"));
  console.log(
    `    ${chalk.green("●")} Pure Static:   ${chalk.bold(stats.byClassification[PageClassification.PURE_STATIC].toString().padStart(4))} pages`,
  );
  console.log(
    `    ${chalk.yellow("●")} Routing Only: ${chalk.bold(stats.byClassification[PageClassification.ROUTING_ONLY].toString().padStart(4))} pages`,
  );
  console.log(
    `    ${chalk.blue("●")} Interactive:  ${chalk.bold(stats.byClassification[PageClassification.INTERACTIVE].toString().padStart(4))} pages`,
  );
  console.log(chalk.dim(`    ${"─".repeat(30)}`));
  console.log(
    `    Total:         ${chalk.bold(stats.totalPages.toString().padStart(4))} pages`,
  );
  console.log("");

  // Processing time
  console.log(
    chalk.dim(`  Completed in ${formatDuration(stats.processingTime)}`),
  );
  console.log("");
  console.log(separator);

  console.log("");
  console.log(chalk.bold("  Per-page Details"));
  console.log("");

  for (const page of stats.pages) {
    const icon = getClassificationIcon(page.analysis.classification);
    const sizeDiff = page.analysis.originalSize - page.newSize;
    const saved =
      sizeDiff > 0
        ? chalk.green(`-${formatBytes(sizeDiff)}`)
        : chalk.dim("unchanged");

    console.log(
      `    ${icon} ${basename(page.analysis.absolutePath).padStart(40)}`,
    );

    console.log(
      chalk.dim(
        `       ${formatBytes(page.analysis.originalSize)} → ${formatBytes(page.newSize)} (${saved})`,
      ),
    );

    if (page.scriptsRemoved > 0 || page.preloadsRemoved > 0) {
      const parts: string[] = [];
      if (page.scriptsRemoved > 0) parts.push(`${page.scriptsRemoved} scripts`);
      if (page.preloadsRemoved > 0)
        parts.push(`${page.preloadsRemoved} preloads`);
      if (page.routerInjected) parts.push("router injected");

      console.log(chalk.dim("       Removed: ") + parts.join(", "));
    }

    console.log("");
  }
}

/**
 * Get an icon for a page classification
 */
function getClassificationIcon(classification: PageClassification): string {
  switch (classification) {
    case PageClassification.PURE_STATIC:
      return chalk.green("●");
    case PageClassification.ROUTING_ONLY:
      return chalk.yellow("●");
    case PageClassification.INTERACTIVE:
      return chalk.blue("●");
  }
}

/**
 * Generate a JSON report
 */
export function generateJsonReport(stats: DehydrateStats): string {
  return JSON.stringify(
    {
      summary: {
        totalPages: stats.totalPages,
        pureStatic: stats.byClassification[PageClassification.PURE_STATIC],
        routingOnly: stats.byClassification[PageClassification.ROUTING_ONLY],
        interactive: stats.byClassification[PageClassification.INTERACTIVE],
        originalSize: stats.totalOriginalSize,
        newSize: stats.totalNewSize,
        bytesSaved: stats.totalOriginalSize - stats.totalNewSize,
        percentSaved:
          ((stats.totalOriginalSize - stats.totalNewSize) /
            stats.totalOriginalSize) *
          100,
        scriptsRemoved: stats.totalScriptsRemoved,
        preloadsRemoved: stats.totalPreloadsRemoved,
        pagesWithRouter: stats.pagesWithRouter,
        processingTimeMs: stats.processingTime,
      },
      pages: stats.pages.map((page) => ({
        path: basename(page.analysis.absolutePath),
        classification: page.analysis.classification,
        originalSize: page.analysis.originalSize,
        newSize: page.newSize,
        scriptsRemoved: page.scriptsRemoved,
        preloadsRemoved: page.preloadsRemoved,
        routerInjected: page.routerInjected,
        indicators: page.analysis.indicators,
      })),
    },
    null,
    2,
  );
}
