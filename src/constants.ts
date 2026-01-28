export const DEFAULT_EXPORT_DIR = "out";
export const DEFAULT_BUILD_DIR = ".next";
export const DEFAULT_SERVER_PORT = 3000;

export const NAVIGATION_OPACITY = 0.7;
export const NAVIGATION_TRANSITION = "0.1s";

export const EVENT_HANDLER_PROPS = [
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
  /\nonTouchMove=/,
  /\bonDragStart=/,
  /\bonDragEnd=/,
  /\bonDrop=/,
] as const;

export const REACT_HOOK_PATTERNS = [
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
] as const;

export const NEXT_LINK_PATTERNS = [
  /import\s+(?:{\s*)?Link(?:\s*})?\s+from\s+['"]next\/link['"]/,
  /import\s+{\s*[^}]*Link[^}]*\s*}\s+from\s+['"]next\/link['"]/,
  /<Link\s+/,
  /<Link>/,
] as const;

export const CLIENT_COMPONENT_PATTERNS = [/"use client"/, /'use client'/] as const;

export const NEXTJS_SCRIPT_PATTERNS = [
  /_next\/static\//,
  /__NEXT_DATA__/,
  /self\.__next_f/,
  /next\/dist\//,
] as const;

export const FILE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"] as const;

export const ROUTER_TYPES = [
  { path: "src/app", routerType: "app", sourceRoot: "src" },
  { path: "src/pages", routerType: "pages", sourceRoot: "src" },
  { path: "app", routerType: "app", sourceRoot: "." },
  { path: "pages", routerType: "pages", sourceRoot: "." },
] as const;

export const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "font/otf",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".pdf": "application/pdf",
};

export const MINIFY_OPTIONS = {
  minifyCSS: true,
  minifyJS: true,
  removeComments: true,
  collapseWhitespace: true,
  removeEmptyAttributes: true,
} as const;
