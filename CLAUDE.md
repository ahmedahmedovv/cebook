# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered EPUB reader with interactive features. It's a client-side web application that uses Mistral AI for word definitions and section summaries. The application has no build system or dependencies - it's pure HTML/CSS/JS with CDN-loaded libraries.

## Development Setup

This is a static web application with no build system. To develop:

```bash
# Serve locally (use any static server)
python -m http.server 8000
# or
npx serve .
```

Then open http://localhost:8000

## Architecture

### Core Files

- **index.html**: Entry point with UI structure (header, file input, loading bar, content area, bottom-sheet popup). Loads JSZip from CDN for EPUB parsing.
- **script.js**: All application logic (~350 lines)
- **style.css**: Fully responsive styling with mobile/tablet breakpoints

### Key Technical Implementation

**EPUB Processing Flow**:
1. File read via FileReader (for browser compatibility) instead of `file.arrayBuffer()`
2. Unzip with JSZip to extract HTML, CSS, and images
3. Convert CSS links to inline `<style>` tags
4. Convert image sources to data URLs via FileReader
5. Parse HTML with DOMParser and extract body content
6. Divide into sections with summary triggers every 1000 words

**Lazy Text Wrapping** (script.js:16-54):
- Uses IntersectionObserver with 400px rootMargin
- Each block element (p, div, h1-h6, li) observed separately
- Words wrapped in clickable `<span class="word">` only when entering viewport
- Critical for performance on large EPUBs (prevents DOM bloat)
- Elements marked with `dataset.wrapped = 'true'` after processing

**Section Division** (script.js:220-270):
- Traverses DOM tree recursively, accumulating text nodes
- Inserts "✦ ✦ ✦ ✦ ✦" trigger elements every ~1000 words
- Stores accumulated section text in `trigger.dataset.summaryText`
- Must maintain proper parent-child DOM relationships during traversal

**Resource Handling**:
- Creates maps for CSS files (by filename and full path)
- Creates maps for images (by filename, full path, and "images/" prefix)
- All paths handled with multiple lookup strategies to catch different EPUB structures

**AI Integration**:
- API key in script.js:1
- Single `callAI()` function handles all Mistral API calls
- Model: `mistral-large-latest`
- Word definitions: one-sentence responses
- Section summaries: 7-8 sentences, text truncated to 5000 chars before sending

**Scroll Persistence**:
- Saves position to localStorage keyed by book filename
- Only saves when `isBookLoaded === true`
- Auto-restores on book load

**Auto-hiding Header**:
- Tracks scroll direction via `lastScrollY` comparison
- Hides header on downward scroll (when scrollY > 100px)
- Only active when `isBookLoaded === true`

## Responsive Design

Three breakpoint ranges:
1. **Mobile Portrait (≤480px)**: Stacked layout, full-width buttons, 80vh popup
2. **Mobile Landscape/iPad Mini Portrait (481-834px)**: Balanced layout, 75vh popup
3. **iPad Mini Landscape/Tablets (835-1024px)**: Near-desktop experience

Key mobile optimizations:
- 44-48px minimum tap targets
- Touch feedback with `:active` states
- Safe area insets for notched devices
- `-webkit-overflow-scrolling: touch` for iOS
- Removed tap highlights with `-webkit-tap-highlight-color: transparent`

## Styling Architecture

**External Dependencies**: Bookerly font from cdnfonts.com

**Layout Pattern**: Fixed header with smooth transform-based hide/show, centered content container (max-width: 800px), fixed bottom-sheet popup with slide-up animation

**Interactive Elements**:
- `.word` spans: clickable with hover/active states
- `.section-trigger`: Large touch targets (40px padding) with scale animations
- Bottom sheet: 70-80vh max height, rounded top corners, backdrop shadow

## Important Constraints

- No build process or bundler - direct file editing
- All dependencies loaded via CDN (JSZip, Bookerly font)
- FileReader used instead of modern file APIs for compatibility
- EPUB images/CSS embedded as data URLs/inline styles (no external references)
- API key intentionally in client code (no backend)
