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

export async function dehydrate(
  config: DehydrateConfig,
): Promise<DehydrateStats> {
  const startTime = Date.now();
  setVerbose(config.verbose);

  const buildResult = await detectBuildMode();
  const generatedPages = await findPages(buildResult);
  const analyses = await analyzePages(generatedPages, buildResult);
  const processedPages = await processPages(buildResult, analyses);

  const stats = calculateStats(processedPages, startTime);
  printStats(stats);
  printOutputLocation(buildResult);

  return stats;
}

async function detectBuildMode() {
  const spinner = ora("Detecting build mode...").start();

  try {
    const buildResult = await detectBuild();
    await validateBuild(buildResult);
    spinner.succeed(
      `Detected: ${chalk.cyan(describeBuildMode(buildResult.mode))}`,
    );
    return buildResult;
  } catch (error) {
    spinner.fail("Build detection failed");
    throw error;
  }
}

async function findPages(buildResult: Awaited<ReturnType<typeof detectBuild>>) {
  const spinner = ora("Finding generated pages...").start();

  try {
    const generatedPages = await findGeneratedPages(buildResult);

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
    return generatedPages;
  } catch (error) {
    spinner.fail("Failed to find HTML files");
    throw error;
  }
}

async function analyzePages(
  generatedPages: { html: string; sourceJsx: string }[],
  buildResult: Awaited<ReturnType<typeof detectBuild>>,
) {
  const spinner = ora("Analyzing pages...").start();

  try {
    const analyses: PageAnalysis[] = [];

    for (const page of generatedPages) {
      const analysis = await analyzeGeneratedPage({ page, buildResult });
      analyses.push(analysis);
    }

    spinner.succeed(`Analyzed ${chalk.cyan(analyses.length)} pages`);
    return analyses;
  } catch (error) {
    spinner.fail("Page analysis failed");
    throw error;
  }
}

async function processPages(
  buildResult: Awaited<ReturnType<typeof detectBuild>>,
  analyses: PageAnalysis[],
) {
  const spinner = ora("Processing pages...").start();

  try {
    const processedPages = await generateOutput(buildResult, analyses);
    spinner.succeed(`Processed ${chalk.cyan(processedPages.length)} pages`);
    return processedPages;
  } catch (error) {
    spinner.fail("Processing failed");
    throw error;
  }
}

function printOutputLocation(buildResult: Awaited<ReturnType<typeof detectBuild>>) {
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
}

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
