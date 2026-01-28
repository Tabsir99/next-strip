import { readFile } from "node:fs/promises";
import { load, type CheerioAPI } from "cheerio";
import { PageClassification, type PageAnalysis } from "../types.js";
import { createLogger } from "../utils/logger.js";
import { NEXTJS_SCRIPT_PATTERNS } from "../constants.js";

const logger = createLogger("stripper");

export interface StripResult {
  html: string;
  scriptsRemoved: number;
  preloadsRemoved: number;
}

export async function processHtmlFile(
  analysis: PageAnalysis,
): Promise<StripResult> {
  const content = await readFile(analysis.absolutePath, "utf-8");
  const $ = load(content);

  if (analysis.classification === PageClassification.INTERACTIVE) {
    return {
      html: $.html(),
      scriptsRemoved: 0,
      preloadsRemoved: 0,
    };
  }

  return stripAllScripts($);
}

function stripAllScripts($: CheerioAPI): StripResult {
  let scriptsRemoved = 0;
  let preloadsRemoved = 0;

  $("script[src]").each((_, el) => {
    const $script = $(el);
    const src = $script.attr("src") ?? "";

    if (isNextJsScript(src)) {
      $script.remove();
      scriptsRemoved++;
    }
  });

  $("script:not([src])").each((_, el) => {
    const $script = $(el);
    const type = $script.attr("type") ?? "";
    const content = $script.html() ?? "";

    if (shouldPreserveInlineScript(type)) {
      return;
    }

    if (isNextJsScript(content)) {
      $script.remove();
      scriptsRemoved++;
    }
  });

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

function shouldPreserveInlineScript(type: string): boolean {
  if (!type) return false;
  if (type === "application/ld+json") return true;
  if (type === "text/javascript" || type === "module") return false;
  return true;
}

function isNextJsScript(src: string): boolean {
  if (!src) return false;
  return NEXTJS_SCRIPT_PATTERNS.some((pattern) => pattern.test(src));
}

export async function getProcessedHtml(
  analysis: PageAnalysis,
  spaRouterScript?: string,
): Promise<StripResult & { routerInjected: boolean }> {
  const result = await processHtmlFile(analysis);

  if (
    analysis.classification === PageClassification.ROUTING_ONLY &&
    spaRouterScript
  ) {
    const $ = load(result.html);
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
