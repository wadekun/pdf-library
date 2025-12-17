# PDF.js 到 React-PDF 迁移方案

## 概述

本文档详细描述了将项目从直接使用 PDF.js 迁移到 React-PDF 的技术方案和实施计划。

## 1. 背景和目标

### 当前状况
- 直接使用 `pdfjs-dist` 3.11.174
- 手动实现 PDF 渲染到 Canvas
- 自定义实现懒加载、缩放、页面追踪等功能
- 代码复杂度高，维护成本大

### 迁移目标
- 简化代码结构，提高可维护性
- 获得更好的 React 集成体验
- 利用 React-PDF 的内置优化
- 保持现有功能不变

## 2. 技术对比

| 特性 | 当前 PDF.js 实现 | React-PDF 实现 |
|------|----------------|----------------|
| 组件化 | 手动管理 Canvas | 声明式组件 |
| 懒加载 | 自定义 Intersection Observer | 内置支持 |
| 缩放功能 | 手动计算和重绘 | scale prop 自动处理 |
| 文本选择 | 需要额外实现 | 内置 Text Layer |
| 注释支持 | 需要额外实现 | 内置 Annotation Layer |
| 错误处理 | 手动实现 | 内置 error boundary |
| TypeScript | 部分类型支持 | 完整类型定义 |

## 3. 实施方案

### 3.1 React-PDF Vite 最佳实践

#### Worker 配置方案

**react-pdf**（用于显示PDF）没有官方的 Vite 插件。推荐使用 Vite 标准的 worker 配置方式：

```typescript
// 在 src/components/PDFReader.tsx 或入口文件中
import { pdfjs } from 'react-pdf';

// Vite 推荐的 Worker 配置方式
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// 注意：对于 Chrome 扩展，需要特殊处理
// 方案1：使用 Chrome 扩展的 runtime URL（当前方案）
pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');

// 方案2：将 worker 打包到 assets 中，通过 manifest 声明
// 需要将 worker 文件复制到 public 目录
```

#### Vite 配置优化

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    react(),
    // crx 插件应该放在最后，因为它会接管 HTML 入口处理
    crx({ manifest }),
  ],

  // optimizeDeps 配置
  optimizeDeps: {
    include: [
      'react-pdf',
      'pdfjs-dist',
    ],
    exclude: [
      // 可能需要排除一些依赖以避免重复打包
    ],
  },

  // 构建配置
  build: {
    rollupOptions: {
      output: {
        // 确保 worker 文件正确输出
        manualChunks: {
          vendor: ['react', 'react-dom'],
          pdf: ['react-pdf', 'pdfjs-dist'],
        },
      },
    },
  },

  // 确保 worker 文件能被正确处理
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name][extname]`
      }
    }
  }
})
```

### 3.2 依赖更新

```bash
# 移除现有依赖
npm uninstall pdfjs-dist

# 安装 React-PDF
npm install react-pdf@^7.0.0
```

### 3.2 文件改动清单

#### 1. **package.json**
   - 移除 `pdfjs-dist: "3.11.174"`
   - 添加 `react-pdf: "^7.0.0"`
   - react-pdf 会自动安装 pdfjs-dist 作为依赖

#### 2. **vite.config.ts**
   - 调整插件顺序（crx 放在最后）
   - 配置 optimizeDeps 包含 react-pdf
   - 设置 worker 格式和输出配置

#### 3. **src/components/PDFReader.tsx**
   - 导入 React-PDF 组件
   - 添加 CSS 导入
   - 重构主渲染逻辑
   - 调整状态管理

#### 3. **src/components/PDFPage.tsx**
   - 简化为轻量级包装器
   - 移除 Canvas 渲染逻辑
   - 保留页面追踪逻辑

#### 4. **src/App.tsx**（如需要）
   - 确保全局样式导入

### 3.3 核心改动详情

#### vite.config.ts 配置

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import reactPdf from '@react-pdf/plugin-vite'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    reactPdf(), // React-PDF Vite 插件
  ],
  // 插件会自动配置 PDF.js worker
  // 无需手动配置 worker 路径
})
```

#### PDFReader.tsx 主要改动

```typescript
// 导入改动
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Worker 配置（Chrome 扩展方式）
pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');

// 或者使用 Vite 推荐方式（需要调整 manifest）
// pdfjs.GlobalWorkerOptions.workerSrc = new URL(
//   'pdfjs-dist/build/pdf.worker.min.mjs',
//   import.meta.url,
// ).toString();

// 状态简化
const [numPages, setNumPages] = useState<number | null>(null);
const [scale, setScale] = useState(1.2);

// 事件处理
const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
  setNumPages(numPages);
  setPageDimensions({
    width: 612,  // 默认 A4 宽度
    height: 792  // 默认 A4 高度
  });
};

// 渲染逻辑
<Document
  file={fileData.handle.getFile()}
  onLoadSuccess={onDocumentLoadSuccess}
  loading={<LoadingSpinner />}
  error={<ErrorDisplay />}
>
  {Array.from({ length: numPages || 0 }, (_, i) => (
    <OptimizedPage
      key={i + 1}
      pageNumber={i + 1}
      scale={scale}
      onVisible={handlePageVisible}
    />
  ))}
</Document>
```

#### PDFPage.tsx 简化

```typescript
// 从自定义 Canvas 渲染改为 React-PDF Page 组件
import { Page } from 'react-pdf';

const OptimizedPage = memo(({
  pageNumber,
  scale,
  onVisible
}: {
  pageNumber: number;
  scale: number;
  onVisible: (page: number) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // 保留 Intersection Observer 用于页面追踪
  useEffect(() => {
    // ... 现有的 Observer 逻辑
  }, []);

  return (
    <div
      ref={containerRef}
      id={`page-${pageNumber}`}
      className="pdf-page-container"
    >
      {isVisible && (
        <Page
          pageNumber={pageNumber}
          scale={scale}
          className="pdf-page"
          renderTextLayer={true}
          renderAnnotationLayer={true}
          onRenderSuccess={() => onVisible(pageNumber)}
        />
      )}
    </div>
  );
});
```

## 4. 实施步骤

### 4.1 Implementation TODO List

- [ ] **阶段 1：准备工作**
  - [ ] 备份当前代码
  - [ ] 创建新的功能分支 `feature/react-pdf-migration`
  - [ ] 更新 package.json 依赖
  - [ ] 安装 react-pdf

- [ ] **阶段 2：Vite 配置和样式**
  - [ ] 更新 vite.config.ts，调整插件顺序和 optimizeDeps
  - [ ] 在入口文件导入 React-PDF CSS
  - [ ] 配置 PDF.js worker（使用 Chrome 扩展方式）
  - [ ] 添加必要的类型定义

- [ ] **阶段 3：重构 PDFPage.tsx**
  - [ ] 创建新的 OptimizedPage 组件
  - [ ] 实现 Intersection Observer 逻辑
  - [ ] 添加页面包装器样式
  - [ ] 测试单页渲染

- [ ] **阶段 4：重构 PDFReader.tsx**
  - [ ] 导入 React-PDF 组件
  - [ ] 实现 Document 组件包装
  - [ ] 添加加载和错误处理
  - [ ] 实现页面列表渲染
  - [ ] 调整缩放逻辑

- [ ] **阶段 5：集成测试**
  - [ ] 测试 PDF 加载功能
  - [ ] 测试页面导航
  - [ ] 测试缩放功能
  - [ ] 测试滚动和懒加载
  - [ ] 测试阅读进度保存

- [ ] **阶段 6：性能优化**
  - [ ] 优化页面渲染性能
  - [ ] 调整 Intersection Observer 参数
  - [ ] 实现页面预加载策略
  - [ ] 内存使用测试

- [ ] **阶段 7：功能验证**
  - [ ] 验证所有原有功能正常
  - [ ] 测试 Chrome 扩展集成
  - [ ] 测试文件系统访问
  - [ ] 测试多语言支持

- [ ] **阶段 8：清理和文档**
  - [ ] 移除旧的 PDF.js 相关代码
  - [ ] 更新组件文档
  - [ ] 代码审查和优化
  - [ ] 准备合并请求

### 4.2 风险评估和缓解策略

| 风险 | 影响 | 缓解策略 |
|------|------|----------|
| CSS 样式冲突 | 中 | 使用 CSS Modules 或 scoped styles |
| 性能下降 | 低 | 利用 React-PDF 的内置优化，逐步调优 |
| 功能缺失 | 低 | 充分测试，必要时回退到自定义实现 |
| 兼容性问题 | 低 | React-PDF 基于 PDF.js，兼容性好 |

### 4.3 测试策略

1. **单元测试**
   - 组件渲染测试
   - 事件处理测试
   - 状态管理测试

2. **集成测试**
   - 完整阅读流程
   - Chrome 扩展功能
   - 存储和恢复功能

3. **性能测试**
   - 大文件加载性能
   - 内存使用情况
   - 滚动流畅度

## 5. 预期收益

### 5.1 代码质量提升
- 代码行数减少约 40-50%
- 降低复杂度，提高可读性
- 减少 bug 风险

### 5.2 功能增强
- 自动获得文本选择功能
- 支持 PDF 注释显示
- 更好的错误处理

### 5.3 维护成本降低
- 减少底层 PDF.js 操作
- 利用社区维护的组件
- 更容易的 future 升级

### 5.4 开发体验提升
- **简化配置**：通过标准 Vite worker 配置
- **更好的构建优化**：通过 manualChunks 实现 PDF 模块分离
- **开发环境优化**：支持热重载，开发更快
- **生产环境优化**：自动压缩和缓存优化
- **类型安全**：React-PDF 提供完整的 TypeScript 类型定义

## 6. 时间预估

- 总体工作量：2-3 天
- 核心开发：1-2 天
- 测试和优化：1 天
- 文档和清理：0.5 天

## 7. 成功标准

1. 所有现有功能正常工作
2. 性能不低于当前实现
3. 代码更简洁、更易维护
4. 通过所有测试用例
5. Chrome 扩展功能完全正常

## 8. 回滚计划

如果迁移出现问题，可以通过以下步骤快速回滚：
1. 切换到备份分支
2. 恢复 package.json
3. 重新安装原依赖
4. 验证功能正常

## 9. 后续优化方向

1. 实现虚拟滚动（大量页面时）
2. 添加 PDF 搜索功能
3. 支持更多 PDF 交互功能
4. 实现主题切换（暗黑模式）

## 10. Chrome 扩展特别说明

### 10.1 React-PDF 与扩展的兼容性

React-PDF 可以很好地集成到 Chrome 扩展项目中：

1. **Worker 配置选项**：
   - **方案1（推荐）**：继续使用 Chrome 扩展的 runtime URL
     ```typescript
     pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
     ```
   - **方案2**：使用 Vite 的 URL 导入（需要调整 manifest）
     ```typescript
     pdfjs.GlobalWorkerOptions.workerSrc = new URL(
       'pdfjs-dist/build/pdf.worker.min.mjs',
       import.meta.url,
     ).toString();
     ```

2. **构建优化**：
   - 通过 manualChunks 将 PDF 相关代码分离
   - Worker 文件需要通过 manifest.json 正确声明
   - 确保符合 Manifest V3 的安全策略

3. **最佳实践建议**：
   - 继续使用当前的 Chrome 扩展 worker 配置方式
   - 确保插件顺序正确（crx 在最后）
   - worker 文件需要保持在 public 目录中

### 10.2 迁移后的文件结构

```
dist/
├── manifest.json
├── popup.html
├── index.html
├── assets/
│   ├── index-[hash].js      # 主应用代码
│   ├── pdf-[hash].js        # React-PDF 核心代码
│   └── pdf.worker-[hash].js # PDF.js Worker（自动生成）
└── content/                 # 其他扩展资源
```

### 10.3 常见问题解决

1. **Worker 加载失败**：
   - 确保使用 Chrome 扩展的 runtime URL 方式
   - 检查 manifest.json 中是否正确声明了 worker 文件
   - 验证 worker 文件是否在 public 目录中

2. **开发环境问题**：
   - 清除浏览器扩展缓存
   - 重新加载扩展
   - 检查开发者控制台的错误信息
   - 确保文件系统权限正确

3. **生产环境优化**：
   - 使用 manualChunks 分离 PDF 模块
   - 检查构建输出是否包含 worker 文件
   - 验证 manifest.json 的 web_accessible_resources 配置