import chalk from "chalk";
import {
  PageClassification,
  type DehydrateStats,
  type ProcessedPage,
} from "../types.js";
import { formatBytes, formatDuration } from "../utils/logger.js";
import { basename } from "node:path";

const SEPARATOR_LENGTH = 50;
const DETAILS_PADDING = 40;
const COUNT_PADDING = 4;
const INDENT = "    ";

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

export function printStats(stats: DehydrateStats): void {
  const separator = chalk.dim("─".repeat(SEPARATOR_LENGTH));

  console.log("");
  console.log(separator);
  console.log(chalk.bold("  Dehydration Summary"));
  console.log(separator);
  console.log("");

  printClassificationSummary(stats);

  console.log(
    chalk.dim(`  Completed in ${formatDuration(stats.processingTime)}`),
  );
  console.log("");
  console.log(separator);

  console.log("");
  console.log(chalk.bold("  Per-page Details"));
  console.log("");

  for (const page of stats.pages) {
    printPageDetails(page);
  }
}

function printClassificationSummary(stats: DehydrateStats): void {
  console.log(chalk.dim("  Page Classification:"));

  const classifications = [
    { type: PageClassification.PURE_STATIC, label: "Pure Static:  ", color: chalk.green },
    { type: PageClassification.ROUTING_ONLY, label: "Routing Only:", color: chalk.yellow },
    { type: PageClassification.INTERACTIVE, label: "Interactive: ", color: chalk.blue },
  ];

  for (const { type, label, color } of classifications) {
    const count = stats.byClassification[type].toString().padStart(COUNT_PADDING);
    console.log(`${INDENT}${color("●")} ${label} ${chalk.bold(count)} pages`);
  }

  console.log(chalk.dim(`${INDENT}${"─".repeat(30)}`));
  console.log(
    `${INDENT}Total:         ${chalk.bold(stats.totalPages.toString().padStart(COUNT_PADDING))} pages`,
  );
  console.log("");
}

function printPageDetails(page: ProcessedPage): void {
  const icon = getClassificationIcon(page.analysis.classification);
  const fileName = basename(page.analysis.absolutePath).padStart(DETAILS_PADDING);
  const sizeDiff = page.analysis.originalSize - page.newSize;
  const saved =
    sizeDiff > 0
      ? chalk.green(`-${formatBytes(sizeDiff)}`)
      : chalk.dim("unchanged");

  console.log(`${INDENT}${icon} ${fileName}`);

  console.log(
    chalk.dim(
      `       ${formatBytes(page.analysis.originalSize)} → ${formatBytes(page.newSize)} (${saved})`,
    ),
  );

  if (page.scriptsRemoved > 0 || page.preloadsRemoved > 0 || page.routerInjected) {
    const parts: string[] = [];
    if (page.scriptsRemoved > 0) parts.push(`${page.scriptsRemoved} scripts`);
    if (page.preloadsRemoved > 0) parts.push(`${page.preloadsRemoved} preloads`);
    if (page.routerInjected) parts.push("router injected");

    console.log(chalk.dim("       Removed: ") + parts.join(", "));
  }

  console.log("");
}

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
