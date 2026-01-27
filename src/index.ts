/**
 * next-strip
 * Post-process Next.js builds to selectively remove unnecessary JavaScript
 */

import ora from "ora";
import chalk from "chalk";
import {
  type DehydrateConfig,
  type DehydrateStats,
  type PageAnalysis,
  BuildMode,
} from "./types.js";
import {
  detectBuild,
  validateBuild,
  describeBuildMode,
} from "./modules/build-detection.js";
import { analyzeGeneratedPage } from "./modules/html-analyzer.js";
import {
  generateOutput,
  findGeneratedPages,
} from "./modules/output-generator.js";
import { calculateStats, printStats } from "./modules/stats-reporter.js";
import { createLogger, setVerbose } from "./utils/logger.js";

const logger = createLogger();

/**
 * Main dehydration function
 */
export async function dehydrate(
  config: DehydrateConfig,
): Promise<DehydrateStats> {
  const startTime = Date.now();

  // Set verbose mode
  setVerbose(config.verbose);

  // Step 1: Detect build mode
  const spinner = ora("Detecting build mode...").start();

  let buildResult;
  try {
    buildResult = await detectBuild();
    await validateBuild(buildResult);
    spinner.succeed(
      `Detected: ${chalk.cyan(describeBuildMode(buildResult.mode))}`,
    );
  } catch (error) {
    spinner.fail("Build detection failed");
    throw error;
  }

  // Step 2: Find HTML files
  spinner.start("Finding generated pages...");

  let generatedPages: { html: string; sourceJsx: string }[];
  try {
    generatedPages = await findGeneratedPages(buildResult);
    if (generatedPages.length === 0) {
      spinner.fail("No HTML pages found");
      throw new Error(
        `No HTML files found in ${buildResult.htmlDir}\n` +
          'Ensure you have run "next build" and the build completed successfully.',
      );
    }
    spinner.succeed(
      `Found ${chalk.cyan(generatedPages.length)} generated pages`,
    );
  } catch (error) {
    spinner.fail("Failed to find HTML files");
    throw error;
  }

  // Step 3: Analyze pages
  spinner.start("Analyzing pages...");

  const analyses: PageAnalysis[] = [];
  try {
    for (const page of generatedPages) {
      const analysis = await analyzeGeneratedPage({ page, buildResult });
      analyses.push(analysis);
    }
    spinner.succeed(`Analyzed ${chalk.cyan(analyses.length)} pages`);
  } catch (error) {
    spinner.fail("Page analysis failed");
    throw error;
  }

  // Step 5: Process and generate output
  spinner.start("Processing pages...");

  let processedPages;
  try {
    processedPages = await generateOutput(buildResult, analyses);
    spinner.succeed(`Processed ${chalk.cyan(processedPages.length)} pages`);
  } catch (error) {
    spinner.fail("Processing failed");
    throw error;
  }

  // Step 6: Calculate and display statistics
  const stats = calculateStats(processedPages, startTime);
  printStats(stats);

  // Show output location
  console.log("");
  if (buildResult.mode === BuildMode.STANDARD_BUILD) {
    logger.success(
      `Build optimized in place: ${chalk.cyan(buildResult.buildDir)}`,
    );
    console.log(chalk.dim("  Run with: next start"));
  } else {
    logger.success(`Output written to: ${chalk.cyan(buildResult.buildDir)}`);
    console.log(chalk.dim("  Serve with any static file server"));
  }
  console.log("");

  return stats;
}

/**
 * Export types for external use
 */
export {
  PageClassification,
  BuildMode,
  type DehydrateConfig,
  type DehydrateStats,
  type PageAnalysis,
  type ProcessedPage,
} from "./types.js";

export { detectBuild, describeBuildMode } from "./modules/build-detection.js";
export {
  analyzeGeneratedPage,
  describeClassification,
} from "./modules/html-analyzer.js";
export { getSpaRouterScript } from "./modules/spa-router.js";
export {
  calculateStats,
  generateJsonReport,
} from "./modules/stats-reporter.js";
