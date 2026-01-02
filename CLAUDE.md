# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered EPUB reader with interactive features. It's a client-side web application that uses Mistral AI for word definitions and section summaries. The application has no build system or dependencies - it's pure HTML/CSS/JS with CDN-loaded libraries.

## Architecture

### Core Components

**Entry Point**: `index.html`
- Loads JSZip from CDN for EPUB parsing
- Defines the UI structure: file input, loading bar, content area, and popup
- No bundler or build process required

**Application Logic**: `script.js`
- **EPUB Processing** (lines 41-90): Unzips EPUB files, extracts HTML content, and divides it into sections based on word count (WORD_THRESHOLD = 1000 words)
- **Lazy Text Wrapping** (lines 14-38): Uses IntersectionObserver to wrap words in clickable spans only when they enter the viewport (400px rootMargin). This prevents DOM bloat on large books.
- **AI Integration** (lines 92-129): Calls Mistral AI API for word definitions and section summaries
- **Scroll Persistence** (lines 144-161): Saves scroll position per book file in localStorage

**Styling**: `style.css`
- Tablet-optimized reading experience using Bookerly font from CDN
- Fixed header that auto-hides on scroll down
- Bottom sheet popup for definitions/summaries

### Key Design Patterns

1. **Performance Optimization**: The IntersectionObserver pattern prevents wrapping all text at once. Each block element is observed and only wrapped when visible. This is critical for large EPUBs.

2. **Section Markers**: "✦ ✦ ✦ ✦ ✦" triggers are inserted every ~1000 words. Their `dataset.summaryText` holds the accumulated text buffer for AI summarization.

3. **State Management**: Minimal state tracking with boolean `isBookLoaded` flag to control header hide behavior and scroll position saving tied to file name.

## Development Commands

This is a static web application with no build system. To develop:

```bash
# Serve locally (use any static server)
python -m http.server 8000
# or
npx serve .
```

Then open http://localhost:8000

## API Configuration

The Mistral AI API key is hardcoded in `script.js:1`. When modifying AI functionality:
- All AI calls go through `callAI()` function (lines 93-104)
- Model used: `mistral-large-latest`
- Word definitions request one-sentence responses
- Section summaries request 7-8 sentence summaries, truncated to 5000 chars

## File Structure Notes

- Sample EPUB file included: `Harry_Potter_and_the_Sorcerer_39_s_Stone_Harry_Potter_1 copy 3.epub`
- `.netlify/state.json` indicates Netlify deployment configuration
- No package.json or dependency management - all external libs loaded via CDN
