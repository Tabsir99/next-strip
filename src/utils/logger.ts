import chalk from "chalk";
import type { Logger } from "../types.js";

let verboseMode = false;

export function setVerbose(enabled: boolean): void {
  verboseMode = enabled;
}

export function createLogger(prefix?: string): Logger {
  const formatMessage = (msg: string): string => {
    return prefix ? `${chalk.dim(`[${prefix}]`)} ${msg}` : msg;
  };

  return {
    info(message: string): void {
      console.log(formatMessage(message));
    },

    success(message: string): void {
      console.log(chalk.green("✓"), formatMessage(message));
    },

    warn(message: string): void {
      console.log(chalk.yellow("⚠"), formatMessage(message));
    },

    error(message: string): void {
      console.error(chalk.red("✖"), formatMessage(message));
    },

    verbose(message: string): void {
      if (verboseMode) {
        console.log(chalk.dim("›"), chalk.dim(formatMessage(message)));
      }
    },

    debug(message: string): void {
      if (verboseMode) {
        console.log(chalk.gray(`  ${formatMessage(message)}`));
      }
    },
  };
}

export const logger = createLogger();

const BYTES_IN_KB = 1024;
const SIZES = ["B", "KB", "MB", "GB"] as const;
const MS_IN_SECOND = 1000;
const MS_IN_MINUTE = 60000;

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const i = Math.floor(Math.log(bytes) / Math.log(BYTES_IN_KB));
  const value = bytes / Math.pow(BYTES_IN_KB, i);

  return `${parseFloat(value.toFixed(2))} ${SIZES[i]}`;
}

export function formatDuration(ms: number): string {
  if (ms < MS_IN_SECOND) return `${ms}ms`;
  if (ms < MS_IN_MINUTE) return `${(ms / MS_IN_SECOND).toFixed(2)}s`;

  const minutes = Math.floor(ms / MS_IN_MINUTE);
  const seconds = ((ms % MS_IN_MINUTE) / MS_IN_SECOND).toFixed(0);

  return `${minutes}m ${seconds}s`;
}

export function formatPercent(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}
