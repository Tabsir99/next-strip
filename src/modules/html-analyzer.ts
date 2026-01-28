import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  BuildDetectionResult,
  PageClassification,
  type PageAnalysis,
  type PageIndicators,
} from "../types.js";
import { createLogger } from "../utils/logger.js";
import {
  EVENT_HANDLER_PROPS,
  REACT_HOOK_PATTERNS,
  NEXT_LINK_PATTERNS,
  CLIENT_COMPONENT_PATTERNS,
  FILE_EXTENSIONS,
} from "../constants.js";

const logger = createLogger("analyzer");

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

  const hasClientCode = await hasAnyClientCode(
    page.sourceJsx,
    srcContent,
    buildResult.sourceRootDir,
  );

  const indicators = detectIndicators(srcContent, htmlContent);
  const classification = classifyPage(indicators, hasClientCode);

  logger.verbose(`${page.html}: ${classification}`);

  return {
    absolutePath: page.html,
    classification,
    indicators: { ...indicators, hasClientComponents: hasClientCode },
    originalSize: stats.size,
  };
}

async function hasAnyClientCode(
  jsxPath: string,
  jsxContent: string,
  sourceRootDir: string,
): Promise<boolean> {
  const visited = new Set<string>();
  return await checkClientCodeRecursive(jsxPath, jsxContent, sourceRootDir, visited);
}

async function checkClientCodeRecursive(
  jsxPath: string,
  jsxContent: string,
  sourceRootDir: string,
  visited: Set<string>,
): Promise<boolean> {
  if (visited.has(jsxPath)) return false;
  visited.add(jsxPath);

  if (
    detectClientComponents(jsxContent) ||
    detectReactHooks(jsxContent) ||
    detectEventHandlers(jsxContent)
  ) {
    return true;
  }

  const imports = extractLocalImports(jsxContent);
  const baseDir = dirname(jsxPath);

  for (const importPath of imports) {
    const resolvedPath = resolveImportPath(baseDir, importPath, sourceRootDir);

    if (!resolvedPath || !existsSync(resolvedPath)) continue;

    try {
      const importContent = await readFile(resolvedPath, "utf-8");
      if (
        await checkClientCodeRecursive(
          resolvedPath,
          importContent,
          sourceRootDir,
          visited,
        )
      ) {
        return true;
      }
    } catch (error) {
      logger.verbose(`Failed to read import: ${resolvedPath}`);
    }
  }

  return false;
}

function extractLocalImports(content: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (
      importPath &&
      (importPath.startsWith("./") ||
        importPath.startsWith("../") ||
        importPath.startsWith("@/"))
    ) {
      imports.push(importPath);
    }
  }

  return imports;
}

function resolveImportPath(
  baseDir: string,
  importPath: string,
  sourceRootDir: string,
): string | null {
  let jsxPath: string;

  if (importPath.startsWith("@/")) {
    const withoutAlias = importPath.replace("@/", "");
    jsxPath = join(sourceRootDir, withoutAlias);
  } else {
    jsxPath = join(baseDir, importPath);
  }

  for (const ext of FILE_EXTENSIONS) {
    const withExt = jsxPath + ext;
    if (existsSync(withExt)) return withExt;
  }

  for (const ext of FILE_EXTENSIONS) {
    const indexPath = join(jsxPath, `index${ext}`);
    if (existsSync(indexPath)) return indexPath;
  }

  return null;
}

function detectIndicators(
  srcContent: string,
  htmlContent: string,
): PageIndicators {
  const hasEventHandlers = detectEventHandlers(srcContent);
  const usesReactHooks = detectReactHooks(srcContent);
  const hasClientComponents = detectClientComponents(srcContent);
  const hasClientSideRouting = detectClientSideRouting(srcContent);

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

function detectEventHandlers(content: string): boolean {
  return EVENT_HANDLER_PROPS.some((pattern) => pattern.test(content));
}

function detectReactHooks(content: string): boolean {
  return REACT_HOOK_PATTERNS.some((pattern) => pattern.test(content));
}

function detectClientComponents(content: string): boolean {
  return CLIENT_COMPONENT_PATTERNS.some((pattern) => pattern.test(content));
}

function detectClientSideRouting(content: string): boolean {
  return NEXT_LINK_PATTERNS.some((pattern) => pattern.test(content));
}

function classifyPage(
  indicators: PageIndicators,
  hasClientCode: boolean,
): PageClassification {
  if (
    hasClientCode ||
    indicators.hasEventHandlers ||
    indicators.usesReactHooks ||
    indicators.hasClientComponents
  ) {
    return PageClassification.INTERACTIVE;
  }

  if (indicators.hasClientSideRouting) {
    return PageClassification.ROUTING_ONLY;
  }

  return PageClassification.PURE_STATIC;
}

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
