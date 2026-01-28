#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { dehydrate } from "./index.js";
import { startPreviewServer } from "./modules/preview-server.js";
import type { DehydrateConfig } from "./types.js";
import { DEFAULT_SERVER_PORT } from "./constants.js";

const VERSION = "1.0.0";

function printBanner(): void {
  console.log("");
  console.log(chalk.bold("  next-strip"));
  console.log(
    chalk.dim("  Post-process Next.js builds for progressive enhancement"),
  );
  console.log("");
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("next-strip")
    .description(
      "Post-process Next.js builds to selectively remove unnecessary JavaScript",
    )
    .version(VERSION)
    .option("-s, --serve", "Start a local preview server after processing")
    .option(
      "-p, --port <port>",
      "Port for the preview server",
      DEFAULT_SERVER_PORT.toString(),
    )
    .option("-v, --verbose", "Enable verbose logging")
    .action(async (options) => {
      printBanner();

      const config: DehydrateConfig = {
        verbose: options.verbose ?? false,
        serve: options.serve ?? false,
        port: parseInt(options.port, 10) || DEFAULT_SERVER_PORT,
      };

      try {
        await dehydrate(config);

        if (config.serve) {
          await startPreviewServer(config);
        }
      } catch (error) {
        handleError(error, config.verbose);
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

function handleError(error: unknown, verbose: boolean): void {
  console.error("");
  console.error(
    chalk.red("Error:"),
    error instanceof Error ? error.message : String(error),
  );
  console.error("");

  if (verbose && error instanceof Error && error.stack) {
    console.error(chalk.dim(error.stack));
  }
}

main().catch((error) => {
  console.error(chalk.red("Unexpected error:"), error);
  process.exit(1);
});
