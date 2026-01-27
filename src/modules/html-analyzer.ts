/**
 * HTML Analysis Module
 * Analyzes JSX source files to classify them by interactivity level
 */

import { readFile, stat } from "node:fs/promises";
import {
  BuildDetectionResult,
  PageClassification,
  type PageAnalysis,
  type PageIndicators,
} from "../types.js";
import { createLogger } from "../utils/logger.js";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const logger = createLogger("analyzer");

/**
 * Event handler props that indicate interactivity in JSX
 */
const EVENT_HANDLER_PROPS = [
  /\bonClick=/,
  /\bonChange=/,
  /\bonSubmit=/,
  /\bonKeyDown=/,
  /\bonKeyUp=/,
  /\bonKeyPress=/,
  /\bonFocus=/,
  /\bonBlur=/,
  /\bonInput=/,
  /\bonMouseOver=/,
  /\bonMouseOut=/,
  /\bonMouseDown=/,
  /\bonMouseUp=/,
  /\bonTouchStart=/,
  /\bonTouchEnd=/,
  /\bonTouchMove=/,
  /\bonDragStart=/,
  /\bonDragEnd=/,
  /\bonDrop=/,
];

/**
 * React hook patterns that indicate interactivity
 */
const REACT_HOOK_PATTERNS = [
  /\buseState\b/,
  /\buseEffect\b/,
  /\buseCallback\b/,
  /\buseMemo\b/,
  /\buseRef\b/,
  /\buseContext\b/,
  /\buseReducer\b/,
  /\buseLayoutEffect\b/,
  /\buseImperativeHandle\b/,
  /\buseDebugValue\b/,
  /\buseId\b/,
  /\buseSyncExternalStore\b/,
  /\buseTransition\b/,
  /\buseDeferredValue\b/,
];

/**
 * Next.js Link component usage patterns
 */
const NEXT_LINK_PATTERNS = [
  /import\s+(?:{\s*)?Link(?:\s*})?\s+from\s+['"]next\/link['"]/, // import Link from 'next/link'
  /import\s+{\s*[^}]*Link[^}]*\s*}\s+from\s+['"]next\/link['"]/, // import { Link } from 'next/link'
  /<Link\s+/, // <Link component usage
  /<Link>/, // Self-closing or opening tag
];

/**
 * Detect client-side routing (Next.js Link component usage)
 */
function detectClientSideRouting(srcContent: string): boolean {
  return NEXT_LINK_PATTERNS.some((pattern) => pattern.test(srcContent));
}

/**
 * Client component marker patterns
 */
const CLIENT_COMPONENT_PATTERNS = [/"use client"/, /'use client'/];

interface AnalyzeGeneratedPageParams {
  page: { html: string; sourceJsx: string };
  buildResult: BuildDetectionResult;
}
export async function analyzeGeneratedPage({
  page,
  buildResult,
}: AnalyzeGeneratedPageParams): Promise<PageAnalysis> {
  const srcContent = await readFile(page.sourceJsx, "utf-8");
  const htmlContent = await readFile(page.html, "utf-8");
  const stats = await stat(page.html);

  // Check if page or ANY imported component has client-side code
  const hasClientCode = await hasAnyClientCode(
    page.sourceJsx,
    srcContent,
    buildResult.sourceRootDir,
  );

  const indicators = detectIndicators(srcContent, htmlContent);
  const classification = classifyPage(indicators);

  logger.verbose(`${page.html}: ${classification}`);

  return {
    absolutePath: page.html,
    classification,
    indicators: { ...indicators, hasClientComponents: hasClientCode },
    originalSize: stats.size,
  };
}

/**
 * Recursively check if file or any imports have client code
 */
async function hasAnyClientCode(
  jsxPath: string,
  jsxContent: string,
  sourceRootDir: string,
): Promise<boolean> {
  // Check current file
  if (
    detectClientComponents(jsxContent) ||
    detectReactHooks(jsxContent) ||
    detectEventHandlers(jsxContent)
  ) {
    return true;
  }

  // Extract local imports (ignore node_modules)
  const imports = extractLocalImports(jsxContent);
  const baseDir = dirname(jsxPath);

  // Check each import recursively
  for (const importPath of imports) {
    const resolvedPath = resolveImportPath(baseDir, importPath, sourceRootDir);

    if (!resolvedPath || !existsSync(resolvedPath)) continue;

    try {
      const importContent = await readFile(resolvedPath, "utf-8");
      if (await hasAnyClientCode(resolvedPath, importContent, sourceRootDir)) {
        return true;
      }
    } catch {
      // Ignore read errors
    }
  }

  return false;
}

/**
 * Extract local import paths from source
 */
function extractLocalImports(content: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1] ?? "";
    // Only local imports (starting with ./ or @/)
    if (
      importPath.startsWith("./") ||
      importPath.startsWith("../") ||
      importPath.startsWith("@/")
    ) {
      imports.push(importPath);
    }
  }

  return imports;
}

// Fix needed: Handle when there is a src directory
function resolveImportPath(
  baseDir: string,
  importPath: string,
  sourceRootDir: string,
): string | null {
  let jsxPath: string;

  // Handle @/ alias (resolve from project root)
  if (importPath.startsWith("@/")) {
    const withoutAlias = importPath.replace("@/", "");
    jsxPath = join(sourceRootDir, withoutAlias);
  } else {
    // Relative imports use baseDir
    jsxPath = join(baseDir, importPath);
  }

  // Try with extensions
  const extensions = [".tsx", ".ts", ".jsx", ".js"];

  for (const ext of extensions) {
    const withExt = jsxPath + ext;
    if (existsSync(withExt)) return withExt;
  }

  // Try as index file
  for (const ext of extensions) {
    const indexPath = join(jsxPath, `index${ext}`);
    if (existsSync(indexPath)) return indexPath;
  }

  return null;
}

/**
 * Detect all interactivity indicators in the JSX source
 */
function detectIndicators(
  srcContent: string,
  htmlContent: string,
): PageIndicators {
  const hasEventHandlers = detectEventHandlers(srcContent);
  const usesReactHooks = detectReactHooks(srcContent);
  const hasClientComponents = detectClientComponents(srcContent);
  const hasClientSideRouting = detectClientSideRouting(srcContent);

  // Count script tags and imports in JSX
  const scriptCount = (htmlContent.match(/<script/g) || []).length;
  const preloadCount = (
    htmlContent.match(/rel=["'](?:preload|modulepreload)["']/g) || []
  ).length;

  return {
    hasEventHandlers,
    usesReactHooks,
    hasClientComponents,
    hasClientSideRouting,
    scriptCount,
    preloadCount,
  };
}

/**
 * Detect event handler props in JSX
 */
function detectEventHandlers(content: string): boolean {
  return EVENT_HANDLER_PROPS.some((pattern) => pattern.test(content));
}

/**
 * Detect React hooks usage in the source
 */
function detectReactHooks(rawContent: string): boolean {
  return REACT_HOOK_PATTERNS.some((pattern) => pattern.test(rawContent));
}

/**
 * Detect client component markers
 */
function detectClientComponents(rawContent: string): boolean {
  return CLIENT_COMPONENT_PATTERNS.some((pattern) => pattern.test(rawContent));
}

/**
 * Classify a page based on its indicators
 */
function classifyPage(indicators: PageIndicators): PageClassification {
  // Interactive: requires full React hydration
  if (
    indicators.hasEventHandlers ||
    indicators.usesReactHooks ||
    indicators.hasClientComponents
  ) {
    return PageClassification.INTERACTIVE;
  }

  // Routing only: static content with internal links
  if (indicators.hasClientSideRouting) {
    return PageClassification.ROUTING_ONLY;
  }

  // Pure static: no interactivity needed
  return PageClassification.PURE_STATIC;
}

/**
 * Get a human-readable description of a classification
 */
export function describeClassification(
  classification: PageClassification,
): string {
  switch (classification) {
    case PageClassification.PURE_STATIC:
      return "Pure Static (all scripts removed)";
    case PageClassification.ROUTING_ONLY:
      return "Routing Only (SPA router injected)";
    case PageClassification.INTERACTIVE:
      return "Interactive (scripts preserved)";
  }
}
