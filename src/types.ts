/**
 * Types and interfaces for next-strip
 */

/**
 * Page classification based on interactivity requirements
 */
export enum PageClassification {
  /** No client-side interactivity - remove all scripts */
  PURE_STATIC = "PURE_STATIC",
  /** Static content with internal navigation - inject SPA router */
  ROUTING_ONLY = "ROUTING_ONLY",
  /** Requires full React hydration - preserve all scripts */
  INTERACTIVE = "INTERACTIVE",
}

/**
 * Build mode detection result
 */
export enum BuildMode {
  /** Static export (out/ directory) */
  STATIC_EXPORT = "STATIC_EXPORT",
  /** Standard next build (.next/ directory) */
  STANDARD_BUILD = "STANDARD_BUILD",
}

/**
 * Configuration for the stripping process
 */
export interface DehydrateConfig {
  /** Enable verbose logging */
  verbose: boolean;
  /** Start a local preview server after processing */
  serve: boolean;
  /** Port for the preview server */
  port: number;
}

/**
 * Result of build detection
 */
export interface BuildDetectionResult {
  /** Detected build mode */
  mode: BuildMode;
  /** Path to the build directory */
  buildDir: string;
  /** Path to HTML files */
  htmlDir: string;
  /** Path to static assets */
  assetsDir: string;
  /** Absolute path to the directory that defines routes (app/ or pages/) */
  routesDir: string;
  /** Absolute path to the project source root (project root or /src) */
  sourceRootDir: string;
}

/**
 * Analysis result for a single HTML page
 */
export interface PageAnalysis {
  /** Absolute path to the HTML file */
  absolutePath: string;
  /** Classification of the page */
  classification: PageClassification;
  /** Indicators that led to this classification */
  indicators: PageIndicators;
  /** Original file size in bytes */
  originalSize: number;
}

/**
 * Indicators detected during page analysis
 */
export interface PageIndicators {
  /** Has event handler attributes (onClick, onChange, etc.) */
  hasEventHandlers: boolean;
  /** Uses React hooks (detected via script content) */
  usesReactHooks: boolean;
  /** Has client component markers (use client) */
  hasClientComponents: boolean;
  /** Has client-side routing (Next.js Link component usage) */
  hasClientSideRouting: boolean;
  /** Number of script tags */
  scriptCount: number;
  /** Number of script preload links */
  preloadCount: number;
}

/**
 * Result of processing a single page
 */
export interface ProcessedPage {
  /** Original analysis */
  analysis: PageAnalysis;
  /** New file size after processing */
  newSize: number;
  /** Number of scripts removed */
  scriptsRemoved: number;
  /** Number of preloads removed */
  preloadsRemoved: number;
  /** Whether SPA router was injected */
  routerInjected: boolean;
}

/**
 * Overall statistics for the stripping process
 */
export interface DehydrateStats {
  /** Total pages processed */
  totalPages: number;
  /** Pages by classification */
  byClassification: Record<PageClassification, number>;
  /** Total original size in bytes */
  totalOriginalSize: number;
  /** Total new size in bytes */
  totalNewSize: number;
  /** Total scripts removed */
  totalScriptsRemoved: number;
  /** Total preloads removed */
  totalPreloadsRemoved: number;
  /** Pages with router injected */
  pagesWithRouter: number;
  /** Processing time in milliseconds */
  processingTime: number;
  /** List of processed pages */
  pages: ProcessedPage[];
}

/**
 * Logger interface for consistent output
 */
export interface Logger {
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  verbose(message: string): void;
  debug(message: string): void;
}

/**
 * Script element information extracted from HTML
 */
export interface ScriptInfo {
  /** Script src attribute (if external) */
  src?: string;
  /** Script inline content (if inline) */
  content?: string;
  /** Script type attribute */
  type?: string;
  /** Whether this is a Next.js core script */
  isNextCore: boolean;
  /** Whether this is a module script */
  isModule: boolean;
  /** Whether this should be preserved */
  preserve: boolean;
}

/**
 * Link preload information extracted from HTML
 */
export interface PreloadInfo {
  /** Preload href */
  href: string;
  /** Preload as attribute */
  as: string;
  /** Whether this is for a script */
  isScriptPreload: boolean;
}
