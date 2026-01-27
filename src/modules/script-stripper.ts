/**
 * Script Stripping Module
 * Removes JavaScript and related preload links from HTML pages
 */

import { readFile } from "node:fs/promises";
import { load, type CheerioAPI, type Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";
import { PageClassification, type PageAnalysis } from "../types.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("stripper");

/**
 * Result of stripping scripts from a page
 */
export interface StripResult {
  /** Modified HTML content */
  html: string;
  /** Number of scripts removed */
  scriptsRemoved: number;
  /** Number of preloads removed */
  preloadsRemoved: number;
}

/**
 * Scripts that should always be preserved (even in pure static mode)
 */
const PRESERVE_SCRIPT_PATTERNS = [
  // Analytics that might be explicitly wanted
  /gtag/i,
  /google-analytics/i,
  /googletagmanager/i,
  // Structured data
  /application\/ld\+json/i,
];

/**
 * Process an HTML file according to its classification
 */
export async function processHtmlFile(
  analysis: PageAnalysis,
): Promise<StripResult> {
  const content = await readFile(analysis.absolutePath, "utf-8");
  const $ = load(content);

  switch (analysis.classification) {
    case PageClassification.PURE_STATIC:
      return stripAllScripts($);

    case PageClassification.ROUTING_ONLY:
      return stripAllScripts($);

    case PageClassification.INTERACTIVE:
      // Preserve everything
      return {
        html: $.html(),
        scriptsRemoved: 0,
        preloadsRemoved: 0,
      };
  }
}

/**
 * Next.js specific script patterns to remove
 */
const NEXTJS_SCRIPT_PATTERNS = [
  /_next\/static\//, // Next.js static files
  /__NEXT_DATA__/, // Next.js data
  /self\.__next_f/, // Next.js flight data
  /next\/dist\//, // Next.js distribution files
];

/**
 * Strip Next.js specific scripts while preserving everything else
 */
function stripAllScripts($: CheerioAPI): StripResult {
  let scriptsRemoved = 0;
  let preloadsRemoved = 0;

  // Remove Next.js script tags
  $("script[src]").each((_, el) => {
    const $script = $(el);
    const src = $script.attr("src") ?? "";

    if (isNextJsScript(src)) {
      $script.remove();
      scriptsRemoved++;
    }
  });

  // Remove Next.js inline scripts
  $("script:not([src])").each((_, el) => {
    const $script = $(el);
    const type = $script.attr("type") ?? "";
    const content = $script.html() ?? "";

    // Preserve JSON-LD and other non-JS script types
    if (
      type === "application/ld+json" ||
      (type && type !== "text/javascript" && type !== "module")
    ) {
      return;
    }

    if (isNextJsScript(content)) {
      $script.remove();
      scriptsRemoved++;
    }
  });

  // Remove Next.js script preloads/modulepreloads
  $('link[rel="preload"][as="script"], link[rel="modulepreload"]').each(
    (_, el) => {
      const $link = $(el);
      const href = $link.attr("href") ?? "";

      if (isNextJsScript(href)) {
        $link.remove();
        preloadsRemoved++;
      }
    },
  );

  // Remove Next.js script prefetches
  $('link[rel="prefetch"][as="script"]').each((_, el) => {
    const $link = $(el);
    const href = $link.attr("href") ?? "";

    if (isNextJsScript(href)) {
      $link.remove();
      preloadsRemoved++;
    }
  });

  logger.verbose(
    `Removed ${scriptsRemoved} scripts, ${preloadsRemoved} preloads`,
  );

  return {
    html: $.html(),
    scriptsRemoved,
    preloadsRemoved,
  };
}

/**
 * Check if a script URL is Next.js related
 */
function isNextJsScript(src: string): boolean {
  if (!src) return false;
  return NEXTJS_SCRIPT_PATTERNS.some((pattern) => pattern.test(src));
}

/**
 * Get the processed HTML content for a page
 * This is the main entry point for processing
 */
export async function getProcessedHtml(
  analysis: PageAnalysis,
  spaRouterScript?: string,
): Promise<StripResult & { routerInjected: boolean }> {
  const result = await processHtmlFile(analysis);

  // Inject SPA router for routing-only pages
  if (
    analysis.classification === PageClassification.ROUTING_ONLY &&
    spaRouterScript
  ) {
    const $ = load(result.html);

    // Inject the SPA router script before </body>
    $("body").append(`<script>${spaRouterScript}</script>`);

    return {
      html: $.html(),
      scriptsRemoved: result.scriptsRemoved,
      preloadsRemoved: result.preloadsRemoved,
      routerInjected: true,
    };
  }

  return {
    ...result,
    routerInjected: false,
  };
}
