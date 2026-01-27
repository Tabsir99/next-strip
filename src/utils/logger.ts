/**
 * Logger utility with chalk-based colorized output
 */

import chalk from 'chalk';
import type { Logger } from '../types.js';

let verboseMode = false;

/**
 * Set verbose mode for the logger
 */
export function setVerbose(enabled: boolean): void {
  verboseMode = enabled;
}

/**
 * Create a prefixed logger
 */
export function createLogger(prefix?: string): Logger {
  const formatMessage = (msg: string): string => {
    return prefix ? `${chalk.dim(`[${prefix}]`)} ${msg}` : msg;
  };

  return {
    info(message: string): void {
      console.log(formatMessage(message));
    },

    success(message: string): void {
      console.log(chalk.green('✓'), formatMessage(message));
    },

    warn(message: string): void {
      console.log(chalk.yellow('⚠'), formatMessage(message));
    },

    error(message: string): void {
      console.error(chalk.red('✖'), formatMessage(message));
    },

    verbose(message: string): void {
      if (verboseMode) {
        console.log(chalk.dim('›'), chalk.dim(formatMessage(message)));
      }
    },

    debug(message: string): void {
      if (verboseMode) {
        console.log(chalk.gray(`  ${formatMessage(message)}`));
      }
    },
  };
}

/**
 * Default logger instance
 */
export const logger = createLogger();

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format milliseconds to human-readable duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}
