# next-strip

Post-process Next.js builds to selectively remove unnecessary JavaScript for progressive enhancement.

## Overview

`next-strip` analyzes your Next.js application and intelligently strips away JavaScript that isn't needed for static pages, while preserving interactivity where required. This results in faster page loads, reduced bandwidth usage, and improved performance for content-heavy sites.

## Features

- **Intelligent Analysis**: Automatically detects which pages need JavaScript and which don't
- **Three Classification Levels**:
  - **Pure Static**: No JavaScript needed - all scripts removed
  - **Routing Only**: Static content with internal links - lightweight SPA router injected
  - **Interactive**: React components with interactivity - all scripts preserved
- **Deep Import Analysis**: Recursively checks imported components for client-side code
- **Built-in Preview Server**: Test your optimized build locally
- **Works with Both Build Modes**: Supports static exports (`out/`) and standard builds (`.next/`)
- **Zero Configuration**: Works out of the box with any Next.js project

## Installation

```bash
npm install -g next-strip
```

Or use directly with npx:

```bash
npx next-strip
```

## Usage

### Basic Usage

1. Build your Next.js application:

```bash
next build
# or for static export
next build && next export
```

2. Run next-strip:

```bash
next-strip
```

### With Preview Server

```bash
next-strip --serve
```

### With Custom Port

```bash
next-strip --serve --port 8080
```

### Verbose Mode

```bash
next-strip --verbose
```

## CLI Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--serve` | `-s` | Start a local preview server after processing | `false` |
| `--port <port>` | `-p` | Port for the preview server | `3000` |
| `--verbose` | `-v` | Enable verbose logging | `false` |
| `--version` | | Display version number | |
| `--help` | `-h` | Display help information | |

## How It Works

### 1. Build Detection

Automatically detects your Next.js build type:
- Static export in `out/` directory
- Standard build in `.next/` directory

### 2. Source Analysis

For each HTML page, analyzes the corresponding JSX/TSX source file to detect:
- Event handlers (`onClick`, `onChange`, etc.)
- React hooks (`useState`, `useEffect`, etc.)
- Client components (`"use client"` directive)
- Client-side routing (Next.js `Link` components)
- Imported components (recursively checked)

### 3. Page Classification

**Pure Static**
- No event handlers, hooks, or client components
- All Next.js scripts removed
- Perfect for blog posts, documentation, landing pages

**Routing Only**
- Static content with internal navigation
- Next.js scripts removed
- Lightweight SPA router injected (~2KB)
- Enables client-side navigation without full page reloads

**Interactive**
- Uses React hooks, event handlers, or client components
- All scripts preserved
- Full React hydration maintained

### 4. Optimization

- Removes unused Next.js scripts and preloads
- Minifies HTML output
- Preserves important scripts (analytics, structured data)
- Maintains proper MIME types and assets

## Example Output

```
  next-strip
  Post-process Next.js builds for progressive enhancement

✓ Detected: Static Export (out/)
✓ Found 12 generated pages
✓ Analyzed 12 pages
✓ Processed 12 pages

──────────────────────────────────────────────────
  Dehydration Summary
──────────────────────────────────────────────────

  Page Classification:
    ● Pure Static:      8 pages
    ● Routing Only:     2 pages
    ● Interactive:      2 pages
    ──────────────────────────────
    Total:             12 pages

  Completed in 1.23s

──────────────────────────────────────────────────

  Per-page Details

    ●                                index.html
       45.2 KB → 12.8 KB (-32.4 KB)
       Removed: 8 scripts, 12 preloads

    ●                                about.html
       42.1 KB → 11.2 KB (-30.9 KB)
       Removed: 8 scripts, 12 preloads, router injected

✓ Output written to: out
  Serve with any static file server
```

## Project Structure

```
src/
├── cli.ts                      # CLI entry point
├── index.ts                    # Main orchestration logic
├── types.ts                    # TypeScript type definitions
├── constants.ts                # Centralized constants
├── modules/
│   ├── build-detection.ts      # Build type detection
│   ├── html-analyzer.ts        # Source code analysis
│   ├── script-stripper.ts      # Script removal logic
│   ├── output-generator.ts     # Output generation
│   ├── spa-router.ts           # Lightweight SPA router
│   ├── stats-reporter.ts       # Statistics and reporting
│   └── preview-server.ts       # Built-in HTTP server
└── utils/
    └── logger.ts               # Logging utilities
```

## Use Cases

### Content Websites
Remove JavaScript from blog posts, articles, and documentation pages while keeping interactive elements like search or comments.

### Marketing Sites
Strip JavaScript from landing pages for faster initial loads while maintaining interactive forms and CTAs.

### E-commerce
Optimize product listing pages as static while preserving interactive cart and checkout flows.

### Documentation
Serve documentation as pure HTML with optional SPA navigation for faster browsing.

## Requirements

- Node.js >= 18.0.0
- Next.js project (pages or app router)

## Supported Next.js Features

- ✅ App Router (`app/` directory)
- ✅ Pages Router (`pages/` directory)
- ✅ Static exports (`output: 'export'`)
- ✅ Standard builds
- ✅ TypeScript and JavaScript
- ✅ Client components (`"use client"`)
- ✅ Path aliases (`@/components`)

## Performance Impact

Typical results for content-heavy sites:
- **70-90% reduction** in page size for static pages
- **Faster initial page loads** (no JavaScript parsing)
- **Reduced bandwidth** costs
- **Improved Core Web Vitals** (LCP, FID, CLS)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.
