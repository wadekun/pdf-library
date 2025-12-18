# PDF Library - Chrome Extension

A privacy-first Chrome Extension designed to manage and read your local PDF files directly in the browser. It allows you to organize your local PDF folders into a convenient "bookshelf" and automatically tracks your reading progress for every file.

## 🚀 Key Features

*   **🔒 Privacy First:** Uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) to read files directly from your local disk. **No files are ever uploaded to any server.**
*   **📚 Local Bookshelf:** Add entire directories from your computer to create a personal library.
*   **⏳ Progress Tracking:** Automatically remembers the last page you read for every document. Pick up exactly where you left off.
*   **📂 File Management:** Browse your local directories within the extension's clean interface.
*   **⚡ Modern UI:** Built with React 19 and Tailwind CSS for a fast and responsive experience.

## 🛠️ Tech Stack

*   **Frontend:** [React 19](https://react.dev/) + TypeScript
*   **Build Tool:** [Vite](https://vitejs.dev/) + [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **PDF Engine:** [PDF.js](https://mozilla.github.io/pdf.js/)
*   **Icons:** [Lucide React](https://lucide.dev/)
*   **Storage:** IndexedDB (for file handles) + Chrome Storage Local (for metadata/progress)

## 📦 Installation & Development

### Prerequisites
*   Node.js (v18 or higher recommended)
*   npm or yarn

### 1. Clone and Install
```bash
git clone <repository-url>
cd pdf-library
npm install
```

### 2. Run in Development Mode
This command runs Vite in watch mode, automatically recompiling changes.
```bash
npm run dev
```

### 3. Load into Chrome
1.  Open Chrome and navigate to `chrome://extensions`.
2.  Enable **Developer mode** (toggle switch in the top right).
3.  Click **Load unpacked**.
4.  Select the `dist` folder generated in your project directory.

Your extension should now be active!

## 🏗️ Building for Production

To create a production-ready build:

```bash
npm run build
```

The output will be in the `dist` folder, ready to be zipped and published to the Chrome Web Store.

## 📝 Usage Guide

1.  Click the extension icon in your toolbar to open the popup.
2.  Click **"Open Library"** to view the main interface.
3.  Click **"Add Directory"** to grant access to a folder containing PDFs on your computer.
4.  Click any PDF cover to start reading. Your progress is saved automatically.
5.  **Note:** Due to browser security protections, you may be asked to re-verify directory permissions if you restart your browser.

## 📄 License

MIT