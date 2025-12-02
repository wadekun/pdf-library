# Chrome 扩展程序改造计划

本文档旨在说明将 "PDF Library" Web 应用改造为 Chrome 扩展程序的需求背景、可行性和详细实现方案。

## 1. 需求背景

原始需求是构建一个辅助阅读本地 PDF 文件的工具，核心功能如下：

*   **需求 1:** 支持选择本地磁盘上的一个或多个目录，并展示其中的 PDF 文件列表。
*   **需求 2:** 能够记录每个文件的阅读进度和最后阅读时间。
*   **需求 3:** 双击文件列表中的 PDF 时，可以在浏览器新标签页中打开，并自动跳转到上次阅读的位置。
*   **需求 4:** 提供一个历史记录视图，可以查看最近的阅读活动。
*   **需求 5:** 即使用户关闭并重新打开浏览器，之前添加的目录和阅读进度也应该被“记住”。

## 2. 可行性分析

将当前项目改造为 Chrome 扩展程序是**完全可行**的。

*   **优势:**
    *   项目核心的 React 组件、UI 布局和 PDF 渲染逻辑几乎可以 **100% 复用**。
    *   Chrome 扩展提供了比标准 Web 应用更强大的本地文件访问和持久化能力。

*   **需改造点:**
    *   **文件系统访问:** 必须从标准的 Web API (`window.showDirectoryPicker`) 切换到专为扩展设计的 `chrome.fileSystem` API，以实现更稳定、可持久化的文件访问。
    *   **数据持久化:** `localStorage` 和 `IndexedDB` 需要被替换为 Chrome 扩展推荐的 `chrome.storage.api`，它更适合扩展的生命周期且为异步设计。

## 3. 实现方案

我们将采用分步改造的策略，在最大限度保留现有代码的同时，精确地替换掉与浏览器环境强相关的底层 API。

### 第一步：创建扩展程序的基础结构 (`manifest.json`)

这是扩展程序的核心配置文件。我们将创建一个 `manifest.json` 文件，定义其基本属性。

```json
{
  "manifest_version": 3,
  "name": "PDF Library",
  "version": "1.0",
  "description": "一个本地 PDF 图书管理器和阅读器。",
  "permissions": [
    "storage",
    "tabs",
    {
      "fileSystem": ["read", "retainEntries", "directory"]
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```
*   同时，我们会创建一个简单的 `popup.html` 和 `popup.tsx` 作为用户与扩展交互的入口。点击图标弹出的窗口中将有一个按钮，用于在新标签页打开主应用界面 (`index.html`)。

### 第二步：改造数据持久化逻辑

将 `localStorage` 和 `IndexedDB` 的存储方案统一迁移到 `chrome.storage.local`。

1.  **阅读进度存储:**
    *   修改 `getProgressStore` 和 `saveProgressStore` 函数。
    *   使用 `chrome.storage.local.get` 和 `chrome.storage.local.set` 来异步存取阅读进度数据。

2.  **目录访问凭证存储:**
    *   删除所有 `IndexedDB` 相关的辅助函数。
    *   之后我们将使用 `chrome.storage.local` 来存储通过 `chrome.fileSystem` API 获取的目录访问“凭证 ID”。

### 第三步：改造文件系统访问逻辑 (核心)

这是改造工作的重点，我们将用功能更强大的 `chrome.fileSystem` API 替换 Web File System API。

1.  **选择目录 (`handleAddDirectory` 函数):**
    *   使用 `chrome.fileSystem.chooseEntry({ type: 'openDirectory' })` 替代 `window.showDirectoryPicker`，弹出文件选择窗口让用户选择目录。

2.  **持久化目录权限 (`retainEntry`):**
    *   当用户选择一个目录后，调用 `chrome.fileSystem.retainEntry(entry)`。
    *   此函数会返回一个唯一的凭证 ID（字符串）。我们将这个 ID 与目录名一起存储在 `chrome.storage.local` 中。这是实现“记住目录”功能跨浏览器会话的关键。

3.  **恢复目录权限 (`restoreEntry`):**
    *   在应用启动时（`loadPersistedDirectories` 函数），从 `chrome.storage.local` 中读取所有已保存的凭证 ID。
    *   遍历这些 ID，并使用 `chrome.fileSystem.restoreEntry(id)` 来异步地恢复文件句柄（File Handle），重建对目录的访问权限。

### 第四步：调整构建流程

*   我们将对 `vite.config.ts` 进行微调，以确保 `manifest.json`、`popup.html` 以及图标等静态资源能被正确处理并复制到最终的输出目录（`dist`）。
*   构建完成后，`dist` 文件夹将包含一个完整的、可以被 Chrome 浏览器作为“未打包的扩展程序”直接加载和运行的包。

## 4. 总结

通过上述方案，我们可以将现有的 Web 应用平滑地迁移为一个功能完整的 Chrome 扩展程序。改造的核心是**用扩展专用的、功能更强的 API 替换掉标准的 Web API**，同时完整保留了应用的核心业务逻辑和优秀的用户界面。
