# Privacy Policy for PDF Library

**Last Updated:** December 18, 2025

## 1. Introduction
**PDF Library** ("we", "our", or "the Extension") is a Chrome Extension designed to help users manage and read PDF files stored on their local device. We are committed to protecting your privacy. This policy explains what data we handle and how it is treated.

## 2. Data Collection and Usage

**We do not collect, store, or transmit any of your personal data or file content to external servers.**

*   **Local Processing:** All PDF processing, rendering, and management happens entirely within your browser on your local machine using the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API).
*   **No Cloud Uploads:** Your PDF files never leave your computer. The Extension does not have a backend server.

## 3. Permissions and Data Storage

To function correctly, the Extension utilizes specific browser permissions and storage mechanisms:

*   **`storage` Permission:** We use `chrome.storage.local` to save your application preferences and metadata about your reading progress (e.g., "File X was last read on Page 10"). This data is stored locally on your device and is not synced to any remote server unless you use Chrome's built-in sync features (which are governed by Google's privacy policy).
*   **File Access:** When you explicitly select a folder via the "Add Directory" feature, the Extension requests permission to read files in that specific directory. We strictly use this access to list PDF files and display them to you.
*   **IndexedDB:** We use your browser's IndexedDB to store references (handles) to the folders you have added, allowing the Extension to remember your library across sessions.

## 4. Third-Party Services

*   **PDF.js:** The Extension uses the Mozilla PDF.js library for rendering PDF files. This library is bundled with the Extension and runs locally.
*   **Google Analytics:** The Extension **does not** use Google Analytics or any other third-party tracking scripts.

## 5. Changes to This Policy

We may update this Privacy Policy from time to time. If we make significant changes, we will notify users through the Extension's update notes.

## 6. Contact Us

If you have any questions about this Privacy Policy, please contact us at:
[Your Email Address]
