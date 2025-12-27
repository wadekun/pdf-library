# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PDF Library is a **Chrome Extension** (Manifest V3) that serves as a local PDF library manager and reader. It uses the File System Access API to read files directly from disk - **no files are ever uploaded to servers**. The extension has two entry points:
- `popup.html` → `src/popup.tsx` - Quick popup interface
- `index.html` → `src/index.tsx` - Full-page library/reader view

## Development Commands

```bash
npm run dev      # Start Vite dev server (port 5173) with HMR
npm run build    # Build to dist/ for Chrome extension loading
npm run preview  # Preview production build
```

**Loading the extension during development:**
1. Run `npm run dev`
2. Open `chrome://extensions`
3. Enable Developer Mode
4. Click "Load unpacked" and select the `dist` folder

## Architecture

### Dual Storage Pattern

The app uses two complementary storage systems:

1. **IndexedDB** (`src/lib/indexedDB.ts`) - Stores `FileSystemDirectoryHandle` objects
   - Handles are required for persistent file access across browser sessions
   - Keys are directory IDs (e.g., `dir-MyDocuments-1234567890`)
   - Database name: `PDFLibraryDB`, Store name: `DirectoryHandles`

2. **Chrome Storage Local** (`src/lib/storage.ts`) - Stores reading progress metadata
   - Stores `ReadingProgress` objects: `{ page, totalPages, lastRead }`
   - Key: `progressStore` contains a mapping of filename → progress

### View State Management

The app uses a simple state machine in `App.tsx`:
- `view: ViewState` - Current view ('library' | 'history' | 'reader')
- `previousView: ViewState` - For returning from reader view
- `directories: DirectoryData[]` - Array of added directories with their files
- `currentFile: FileData | null` - Currently open PDF in reader
- `progressStore: Record<string, ReadingProgress>` - All reading progress

### File System Access & Permissions

Browser security requires re-verifying directory permissions after browser restart. The permission flow:

1. `verifyPermission(handle, silent)` - Checks if permission granted
2. If `silent=false` and not granted, calls `handle.requestPermission()`
3. Directories have a `status` field: 'connected' | 'need-permission'
4. "Reconnect" button on directories triggers permission request

### URL Parameters

The full-page view accepts URL params:
- `?view=library` or `?view=history` - Sets initial view
- `?action=open_last_read` - Opens the most recently read file

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main app orchestrator, view routing, directory management |
| `src/popup.tsx` | Popup entry that opens full-page view |
| `src/index.tsx` | Full-page entry point |
| `src/components/PDFReader.tsx` | Full-screen PDF reader with zoom/nav |
| `src/components/PDFPage.tsx` | Individual PDF page rendering |
| `src/components/PDFOutline.tsx` | Table of contents sidebar |
| `src/components/DirectoryRow.tsx` | Directory listing in library view |
| `src/lib/storage.ts` | Storage layer combining IndexedDB + Chrome Storage |
| `src/lib/indexedDB.ts` | Generic IndexedDB wrapper (get/set/del/keys) |
| `src/translations.ts` | i18n for English (`en`) and Chinese (`zh`) |

## Build Configuration

- `vite.config.ts` uses `@crxjs/vite-plugin` for Chrome Extension development
- Rollup inputs: `['index.html', 'popup.html']`
- Manual chunks separate vendor (React) and pdf (react-pdf, pdfjs-dist)
- PDF worker file (`pdf.worker.min.js`) must be in `public/` and listed in `manifest.json` web_accessible_resources

## PDF.js Configuration

The PDF worker path must be set before rendering:
```typescript
import { pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
```

The worker file is served as a web-accessible resource to work within Chrome Extension context.

## Type Definitions

Key types in `src/types.ts`:
- `ViewState`: 'library' | 'history' | 'reader'
- `Lang`: 'en' | 'zh'
- `ReadingProgress`: `{ page: number, totalPages: number, lastRead: number }`
- `FileData`: File handle with metadata and progress
- `DirectoryData`: Directory handle with status and contained files

## Styling

Uses Tailwind CSS with custom scrollbar styles in `index.css`. Primary brand color is indigo (`bg-indigo-600`).
