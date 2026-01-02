# Project Overview

This project is a privacy-first Chrome Extension for managing and reading local PDF files. It allows users to add directories from their local filesystem to create a "bookshelf" of PDFs. The extension tracks reading progress for each file.

**Main Technologies:**

*   **Frontend:** React 19 with TypeScript
*   **Build Tool:** Vite with `@crxjs/vite-plugin` for Chrome extension development
*   **Styling:** Tailwind CSS
*   **PDF Rendering:** PDF.js (via `react-pdf`)
*   **Data Storage:**
    *   **IndexedDB:** Stores File System Access API directory handles for persistent access to local folders.
    *   **Chrome Storage Local:** Stores metadata and reading progress.

**Architecture:**

The extension is a single-page application built with React. It uses the File System Access API to read PDF files directly from the user's local disk, ensuring privacy as no files are uploaded to any server.

*   `src/App.tsx`: The main React component that manages the application's state, including the list of directories, the current view (library, history, or reader), and reading progress.
*   `src/components/`: Contains reusable React components for the UI, such as `PDFReader`, `DirectoryRow`, etc.
*   `src/lib/`:
    *   `indexedDB.ts`: A wrapper for IndexedDB to store and retrieve directory handles.
    *   `storage.ts`: A higher-level abstraction for managing both IndexedDB and Chrome Storage.
*   `vite.config.ts`: Configures Vite for building the Chrome extension, including handling multiple HTML entry points (`index.html` for the main app, `popup.html` for the extension popup).

# Building and Running

**Prerequisites:**

*   Node.js (v18 or higher)
*   npm or yarn

**1. Install Dependencies:**

```bash
npm install
```

**2. Run in Development Mode:**

This command starts Vite in watch mode, which will automatically recompile the extension as you make changes.

```bash
npm run dev
```

**3. Load the Extension in Chrome:**

1.  Open Chrome and navigate to `chrome://extensions`.
2.  Enable **Developer mode**.
3.  Click **Load unpacked**.
4.  Select the `dist` folder that was generated in the project directory.

**4. Build for Production:**

To create a production-ready build of the extension:

```bash
npm run build
```

This will create an optimized build in the `dist` folder, which can be zipped and submitted to the Chrome Web Store.

# Development Conventions

*   **Styling:** The project uses Tailwind CSS for utility-first styling.
*   **State Management:** Application state is managed within the `App.tsx` component using React hooks (`useState`, `useEffect`, `useCallback`).
*   **Data Persistence:**
    *   Directory handles are stored in IndexedDB to maintain access to local folders across browser sessions.
    *   Reading progress and other metadata are stored in Chrome's local storage.
*   **Internationalization:** The UI supports both English and Chinese, with translations managed in `src/translations.ts`.
