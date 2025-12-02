import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Book, 
  Clock, 
  FolderOpen, 
  ArrowLeft, 
  ZoomIn, 
  ZoomOut, 
  FileText,
  AlertCircle,
  History,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Trash2,
  RefreshCw,
  Plus,
  Languages
} from 'lucide-react';

// --- Types ---

interface ReadingProgress {
  page: number;
  totalPages: number;
  lastRead: number; // timestamp
}

interface FileData {
  id: string; // unique ID composed of dirId + fileName
  directoryId: string;
  name: string;
  handle?: FileSystemFileHandle; 
  file?: File; 
  progress?: ReadingProgress;
}

interface DirectoryData {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle | null; // null if from fallback input (session only)
  isExpanded: boolean;
  status: 'connected' | 'need-permission' | 'disconnected';
  files: FileData[];
  error?: string;
}

type ViewState = 'library' | 'reader' | 'history';
type Lang = 'en' | 'zh';

// --- Constants ---
const STORAGE_KEY_PROGRESS = 'pdf_manager_progress';
const DB_NAME = 'PDFManagerDB';
const DB_STORE_HANDLES = 'directory_handles';

const TRANSLATIONS = {
  en: {
    appTitle: "PDF Library",
    appSubtitle: "Personal Book Manager",
    library: "Library",
    history: "History",
    version: "Version",
    headerLibrary: "My Bookshelves",
    headerHistory: "Reading Timeline",
    addDirectory: "Add Directory",
    addFirstDirectory: "Add First Directory",
    emptyLibraryTitle: "Your library is empty",
    emptyLibraryDesc: "Add a local folder to start building your collection. We'll remember the folders you add here.",
    emptyHistory: "No reading history yet.",
    lastRead: "Last read",
    page: "Page",
    of: "of",
    connected: "Connected",
    permissionRequired: "Permission Required",
    reconnect: "Reconnect",
    filesCount: "files",
    noFiles: "No PDF files found in this folder.",
    new: "New",
    loading: "Loading...",
    errorLoading: "Error Loading Reader",
    backToLibrary: "Back to Library",
    fileNotAccessible: "File not accessible in current open directories",
    back: "Back",
    sessionFolder: "Session Folder",
    failedScan: "Failed to scan files. Permission might be needed.",
    errorPdfLoad: "Failed to open PDF file",
    errorEngineLoad: "Failed to load PDF engine",
    permissionDenied: "Permission denied",
    cannotAccess: "Cannot access file content"
  },
  zh: {
    appTitle: "PDF 图书馆",
    appSubtitle: "个人图书管理器",
    library: "书架",
    history: "历史记录",
    version: "版本",
    headerLibrary: "我的书架",
    headerHistory: "阅读时间轴",
    addDirectory: "添加目录",
    addFirstDirectory: "添加第一个目录",
    emptyLibraryTitle: "书架为空",
    emptyLibraryDesc: "添加本地文件夹以建立您的藏书库。我们会记住您在此处添加的文件夹。",
    emptyHistory: "暂无阅读记录。",
    lastRead: "上次阅读",
    page: "页",
    of: "共",
    connected: "已连接",
    permissionRequired: "需要权限",
    reconnect: "重新连接",
    filesCount: "个文件",
    noFiles: "此文件夹中未找到 PDF 文件。",
    new: "新",
    loading: "加载中...",
    errorLoading: "加载阅读器出错",
    backToLibrary: "返回书架",
    fileNotAccessible: "当前打开的目录中无法访问此文件",
    back: "返回",
    sessionFolder: "临时文件夹",
    failedScan: "扫描文件失败。可能需要权限。",
    errorPdfLoad: "打开 PDF 文件失败",
    errorEngineLoad: "加载 PDF 引擎失败",
    permissionDenied: "权限被拒绝",
    cannotAccess: "无法访问文件内容"
  }
};

// --- Helper: IndexedDB for Handles ---
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DB_STORE_HANDLES)) {
        db.createObjectStore(DB_STORE_HANDLES);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveDirectoryHandle = async (id: string, handle: FileSystemDirectoryHandle) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE_HANDLES, 'readwrite');
    const store = tx.objectStore(DB_STORE_HANDLES);
    const req = store.put(handle, id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

const getAllDirectoryHandles = async (): Promise<Record<string, FileSystemDirectoryHandle>> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE_HANDLES, 'readonly');
    const store = tx.objectStore(DB_STORE_HANDLES);
    const req = store.openCursor();
    const results: Record<string, FileSystemDirectoryHandle> = {};
    
    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        results[cursor.key as string] = cursor.value;
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
};

const removeDirectoryHandle = async (id: string) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE_HANDLES, 'readwrite');
    const store = tx.objectStore(DB_STORE_HANDLES);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

// --- Helper: Local Storage Progress ---
const getProgressStore = (): Record<string, ReadingProgress> => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_PROGRESS);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error("Failed to load progress", e);
    return {};
  }
};

const saveProgressStore = (data: Record<string, ReadingProgress>) => {
  localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(data));
};

// --- Component: PDF Page ---
const PDFPage = ({
  pageNumber,
  pdfDoc,
  scale,
  defaultHeight,
  defaultWidth,
  onVisible,
  lang
}: {
  pageNumber: number;
  pdfDoc: any;
  scale: number;
  defaultHeight: number;
  defaultWidth: number;
  onVisible: (page: number) => void;
  lang: Lang;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [inView, setInView] = useState(false);
  const t = TRANSLATIONS[lang];

  // Observer for rendering (Lazy load)
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '50% 0px' } // Start rendering when within 50% of viewport height
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Observer for "Active Page" detection
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
            onVisible(pageNumber);
          }
        });
      },
      { threshold: [0.1, 0.3, 0.5, 0.7] }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  // Render logic
  useEffect(() => {
    if (!inView || !pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          await renderTaskRef.current.cancel();
        }

        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');

        if (!canvas || !context) return;

        // Resize canvas if needed
        if (canvas.height !== viewport.height || canvas.width !== viewport.width) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
        }

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
        setIsRendered(true);
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Error rendering page ${pageNumber}`, err);
        }
      }
    };

    renderPage();
  }, [pdfDoc, pageNumber, scale, inView]);

  return (
    <div 
      ref={containerRef}
      id={`page-${pageNumber}`}
      className="shadow-md mb-4 mx-auto relative bg-white transition-all duration-300"
      style={{
        width: 'fit-content',
        height: isRendered ? 'auto' : `${defaultHeight * scale}px`,
        minHeight: `${defaultHeight * scale}px`, // Placeholder height
      }}
    >
      <canvas 
        ref={canvasRef} 
        className="block mx-auto" 
      />
      {!isRendered && inView && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
           {t.loading}
        </div>
      )}
    </div>
  );
};

// --- Component: PDF Reader ---
const PDFReader = ({ 
  fileData, 
  initialPage, 
  onClose, 
  onProgressUpdate,
  lang
}: { 
  fileData: FileData; 
  initialPage: number; 
  onClose: () => void;
  onProgressUpdate: (page: number, total: number) => void;
  lang: Lang;
}) => {
  const [pdfLib, setPdfLib] = useState<any>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageDimensions, setPageDimensions] = useState<{ width: number, height: number } | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);
  const t = TRANSLATIONS[lang];

  // Load Library
  useEffect(() => {
    const loadLib = async () => {
      try {
        const lib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/+esm');
        const pdfjs = lib.GlobalWorkerOptions ? lib : lib.default;
        if (!pdfjs || !pdfjs.GlobalWorkerOptions) {
           throw new Error("Could not resolve GlobalWorkerOptions");
        }
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        setPdfLib(pdfjs);
      } catch (err: any) {
        console.error("PDF Engine Load Error:", err);
        setError(`${t.errorEngineLoad}: ${err.message || 'Unknown error'}`);
        setLoading(false);
      }
    };
    loadLib();
  }, [lang]);

  // Load Document
  useEffect(() => {
    if (!pdfLib || !fileData) return;

    const loadDoc = async () => {
      setLoading(true);
      setError(null);
      setPageDimensions(null);
      initialScrollDone.current = false;

      try {
        let file: File;
        if (fileData.file) {
          file = fileData.file;
        } else if (fileData.handle) {
          // @ts-ignore
          const perm = await (fileData.handle as any).queryPermission({ mode: 'read' });
          if (perm !== 'granted') {
             // @ts-ignore
             const request = await (fileData.handle as any).requestPermission({ mode: 'read' });
             if (request !== 'granted') throw new Error(t.permissionDenied);
          }
          file = await fileData.handle.getFile();
        } else {
          throw new Error(t.cannotAccess);
        }

        const arrayBuffer = await file.arrayBuffer();
        const doc = await pdfLib.getDocument({ data: arrayBuffer }).promise;
        setPdfDoc(doc);
        
        // Fetch first page to get dimensions for placeholders
        const page1 = await doc.getPage(1);
        const viewport = page1.getViewport({ scale: 1.0 });
        setPageDimensions({ width: viewport.width, height: viewport.height });

        setLoading(false);
      } catch (err: any) {
        console.error("Document Load Error:", err);
        setError(`${t.errorPdfLoad}: ${err.message}`);
        setLoading(false);
      }
    };
    loadDoc();
  }, [pdfLib, fileData.id, fileData.file, fileData.handle, lang]);

  // Handle Scroll to Initial Page
  useEffect(() => {
    if (loading || !pdfDoc || !pageDimensions) return;

    if (initialPage > 1 && !initialScrollDone.current) {
      // Small timeout to allow DOM to render placeholders
      const timer = setTimeout(() => {
        const el = document.getElementById(`page-${initialPage}`);
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'start' });
          
          // CRITICAL: Add a longer delay before enabling progress updates. 
          setTimeout(() => {
            initialScrollDone.current = true;
          }, 500);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, pdfDoc, pageDimensions, initialPage]);

  // Memoized callback to update current page
  const handlePageVisible = useCallback((page: number) => {
    // Guard: Prevent overwriting progress while waiting for initial scroll to a non-first page
    if (initialPage > 1 && !initialScrollDone.current) {
      return;
    }

    setCurrentPage(page);
    if (pdfDoc) {
      onProgressUpdate(page, pdfDoc.numPages);
    }
  }, [pdfDoc, onProgressUpdate, initialPage]);

  // Fixed Dark Theme Styling
  const bgClass = 'bg-gray-900';
  const headerClass = 'bg-gray-800 border-gray-700 text-white';
  const buttonHoverClass = 'hover:bg-gray-700';
  const textClass = 'text-gray-300';

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-500 p-8 text-center bg-gray-50">
        <AlertCircle size={48} />
        <p className="mt-4 text-lg font-semibold">{t.errorLoading}</p>
        <p className="mt-2 text-sm text-red-400 font-mono bg-red-50 p-3 rounded border border-red-100 max-w-lg break-words">
          {error}
        </p>
        <button onClick={onClose} className="mt-6 px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-gray-800 font-medium transition-colors">
          {t.backToLibrary}
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${bgClass} transition-colors duration-300`}>
      {/* Header */}
      <div className={`h-14 ${headerClass} border-b flex items-center justify-between px-4 shadow-md z-10 shrink-0 transition-colors duration-300`}>
        <div className="flex items-center gap-3 w-1/3">
          <button onClick={onClose} className={`p-2 rounded-full transition-colors ${buttonHoverClass}`} title={t.backToLibrary}>
            <ArrowLeft size={20} />
          </button>
          <span className={`font-medium truncate text-sm ${textClass}`}>{fileData.name}</span>
        </div>

        <div className="flex items-center gap-4 justify-center w-1/3">
           <div className="text-sm font-mono px-4 py-1.5 rounded border shadow-inner bg-gray-900 border-gray-700">
            {t.page} {currentPage} / {pdfDoc?.numPages || '-'}
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end w-1/3">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className={`p-2 rounded transition-colors ${buttonHoverClass}`}>
            <ZoomOut size={20} />
          </button>
          <span className={`text-xs w-12 text-center ${textClass}`}>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3.0, s + 0.2))} className={`p-2 rounded transition-colors ${buttonHoverClass}`}>
            <ZoomIn size={20} />
          </button>
        </div>
      </div>

      {/* Main Content (Scrollable) */}
      <div 
        ref={containerRef}
        className={`flex-1 overflow-auto relative scroll-smooth ${bgClass} transition-colors duration-300`}
      >
        {loading || !pageDimensions ? (
          <div className={`absolute inset-0 flex items-center justify-center ${textClass}`}>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="py-8 min-h-full">
            {Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1).map((pageNum) => (
              <PDFPage
                key={pageNum}
                pageNumber={pageNum}
                pdfDoc={pdfDoc}
                scale={scale}
                defaultHeight={pageDimensions.height}
                defaultWidth={pageDimensions.width}
                onVisible={handlePageVisible}
                lang={lang}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Component: Directory Row ---
const DirectoryRow = ({ 
  directory, 
  onToggle, 
  onRemove,
  onVerifyPermission,
  onOpenFile,
  lang
}: { 
  directory: DirectoryData; 
  onToggle: (id: string) => void; 
  onRemove: (id: string) => void;
  onVerifyPermission: (id: string) => void;
  onOpenFile: (file: FileData) => void;
  lang: Lang;
}) => {
  const fileCount = directory.files.length;
  const t = TRANSLATIONS[lang];
  
  return (
    <div className="mb-4 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 bg-white cursor-pointer hover:bg-gray-50 border-b border-transparent"
        onClick={() => onToggle(directory.id)}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="text-gray-400">
             {directory.isExpanded ? <ChevronDown size={20} /> : <ChevronRightIcon size={20} />}
          </div>
          <FolderOpen size={20} className={directory.status === 'connected' ? "text-indigo-500" : "text-gray-400"} />
          <div className="flex flex-col overflow-hidden">
            <span className="font-medium text-gray-800 truncate">{directory.name}</span>
            <span className="text-xs text-gray-500 flex items-center gap-2">
              {directory.status === 'connected' ? (
                <span className="text-green-600">{t.connected}</span>
              ) : directory.status === 'need-permission' ? (
                <span className="text-amber-600 font-medium">{t.permissionRequired}</span>
              ) : (
                <span>{fileCount} {t.filesCount}</span>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {directory.status === 'need-permission' && (
            <button 
              onClick={() => onVerifyPermission(directory.id)}
              className="px-3 py-1.5 text-xs bg-amber-100 text-amber-800 rounded-md hover:bg-amber-200 transition-colors flex items-center gap-1"
            >
              <RefreshCw size={12} />
              {t.reconnect}
            </button>
          )}
          <button 
            onClick={() => onRemove(directory.id)}
            className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
            title="Remove from Library"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {directory.isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-4">
          {directory.error ? (
            <div className="text-red-500 text-sm p-2 flex items-center gap-2">
              <AlertCircle size={16} /> {directory.error}
            </div>
          ) : directory.files.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm italic">
              {t.noFiles}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {directory.files.map((file) => {
                 const progressPct = file.progress 
                 ? Math.round((file.progress.page / file.progress.totalPages) * 100) 
                 : 0;
                 return (
                  <div 
                    key={file.id} 
                    onDoubleClick={() => onOpenFile(file)}
                    className="group bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all flex flex-col h-32"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <FileText size={24} className="text-gray-300 group-hover:text-indigo-400" />
                      {file.progress && (
                        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                          {progressPct}%
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-h-0">
                      <h4 className="text-sm font-medium text-gray-700 line-clamp-2 leading-tight mb-1" title={file.name}>
                        {file.name}
                      </h4>
                    </div>
                    {file.progress ? (
                       <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden mt-2">
                         <div className="h-full bg-indigo-500" style={{ width: `${progressPct}%` }} />
                       </div>
                    ) : (
                      <div className="mt-2 text-[10px] text-gray-400">{t.new}</div>
                    )}
                  </div>
                 )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- Component: Main App ---

const App = () => {
  const [view, setView] = useState<ViewState>('library');
  const [previousView, setPreviousView] = useState<ViewState>('library');
  const [directories, setDirectories] = useState<DirectoryData[]>([]);
  const [currentFile, setCurrentFile] = useState<FileData | null>(null);
  const [progressStore, setProgressStore] = useState<Record<string, ReadingProgress>>({});
  const [lang, setLang] = useState<Lang>('zh');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = TRANSLATIONS[lang];

  // Initialize
  useEffect(() => {
    setProgressStore(getProgressStore());
    loadPersistedDirectories();
  }, []);

  const loadPersistedDirectories = async () => {
    try {
      const handles = await getAllDirectoryHandles();
      const loadedDirs: DirectoryData[] = [];
      
      for (const [id, handle] of Object.entries(handles)) {
        loadedDirs.push({
          id,
          name: handle.name,
          handle: handle,
          isExpanded: false,
          status: 'need-permission', // Always assume need-permission on reload
          files: []
        });
      }
      setDirectories(loadedDirs);
    } catch (e) {
      console.error("Failed to load directories from DB", e);
    }
  };

  const handleAddDirectory = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        // @ts-ignore
        const handle = await window.showDirectoryPicker();
        const id = crypto.randomUUID();
        
        await saveDirectoryHandle(id, handle);
        
        const newDir: DirectoryData = {
          id,
          name: handle.name,
          handle,
          isExpanded: true,
          status: 'connected',
          files: []
        };
        
        setDirectories(prev => [...prev, newDir]);
        scanDirectory(newDir.id, handle); // Scan immediately
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn("Native picker failed", err);
          fileInputRef.current?.click(); // Fallback
        }
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFallbackScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files);
      const folderName = fileList[0].webkitRelativePath.split('/')[0] || t.sessionFolder;
      
      const dirId = 'session-' + Date.now();
      const pdfFiles: FileData[] = [];
      const store = getProgressStore();

      fileList.forEach(file => {
        if (file.name.toLowerCase().endsWith('.pdf')) {
          pdfFiles.push({
            id: `${dirId}-${file.name}`,
            directoryId: dirId,
            name: file.name,
            file: file,
            progress: store[file.name] // Match by name across folders for simplicity
          });
        }
      });

      const newDir: DirectoryData = {
        id: dirId,
        name: folderName,
        handle: null,
        isExpanded: true,
        status: 'connected',
        files: pdfFiles
      };

      setDirectories(prev => [...prev, newDir]);
      e.target.value = ''; 
    }
  };

  const scanDirectory = async (dirId: string, handle: FileSystemDirectoryHandle) => {
    const store = getProgressStore();
    const pdfFiles: FileData[] = [];

    try {
      // @ts-ignore
      for await (const entry of handle.values()) {
        if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
          pdfFiles.push({
            id: `${dirId}-${entry.name}`,
            directoryId: dirId,
            name: entry.name,
            handle: entry as FileSystemFileHandle,
            progress: store[entry.name]
          });
        }
      }
      
      setDirectories(prev => prev.map(dir => 
        dir.id === dirId ? { ...dir, files: pdfFiles, error: undefined, status: 'connected' } : dir
      ));
    } catch (e: any) {
      console.error(e);
      setDirectories(prev => prev.map(dir => 
        dir.id === dirId ? { ...dir, error: t.failedScan } : dir
      ));
    }
  };

  const toggleDirectory = async (id: string) => {
    const dir = directories.find(d => d.id === id);
    if (!dir) return;

    if (!dir.isExpanded) {
      // Expanding
      if (dir.handle) {
        // Check permission if needed
        if (dir.status === 'need-permission') {
           // We can't auto-scan if we need permission, user needs to click 'Reconnect' or we prompt now?
           // Let's try to query first.
           try {
             // @ts-ignore
             const perm = await (dir.handle as any).queryPermission({ mode: 'read' });
             if (perm === 'granted') {
               await scanDirectory(id, dir.handle);
               setDirectories(prev => prev.map(d => d.id === id ? { ...d, isExpanded: true, status: 'connected' } : d));
             } else {
               // Cannot auto-expand without permission
               setDirectories(prev => prev.map(d => d.id === id ? { ...d, isExpanded: true } : d));
               // The UI will show "Permission Required" and a button
             }
           } catch (e) {
             console.error(e);
           }
        } else {
           await scanDirectory(id, dir.handle);
           setDirectories(prev => prev.map(d => d.id === id ? { ...d, isExpanded: true } : d));
        }
      } else {
        // Session dir, just expand
        setDirectories(prev => prev.map(d => d.id === id ? { ...d, isExpanded: true } : d));
      }
    } else {
      // Collapsing
      setDirectories(prev => prev.map(d => d.id === id ? { ...d, isExpanded: false } : d));
    }
  };

  const verifyPermission = async (id: string) => {
    const dir = directories.find(d => d.id === id);
    if (!dir || !dir.handle) return;

    try {
      // @ts-ignore
      const perm = await (dir.handle as any).requestPermission({ mode: 'read' });
      if (perm === 'granted') {
        setDirectories(prev => prev.map(d => d.id === id ? { ...d, status: 'connected' } : d));
        scanDirectory(id, dir.handle);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const removeDirectory = async (id: string) => {
    await removeDirectoryHandle(id);
    setDirectories(prev => prev.filter(d => d.id !== id));
  };

  const handleOpenFile = (file: FileData) => {
    setCurrentFile(file);
    setPreviousView(view);
    setView('reader');
  };

  const handleProgressUpdate = (page: number, total: number) => {
    if (!currentFile) return;
    
    const newProgress: ReadingProgress = {
      page,
      totalPages: total,
      lastRead: Date.now()
    };

    const newStore = {
      ...progressStore,
      [currentFile.name]: newProgress
    };

    setProgressStore(newStore);
    saveProgressStore(newStore);

    // Update state everywhere
    setCurrentFile(prev => prev ? { ...prev, progress: newProgress } : null);
    setDirectories(prev => prev.map(dir => ({
      ...dir,
      files: dir.files.map(f => f.name === currentFile.name ? { ...f, progress: newProgress } : f)
    })));
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  // Flatten all files for History view
  const historyItems = Object.entries(progressStore)
    .sort(([, a], [, b]) => b.lastRead - a.lastRead)
    .map(([name, progress]) => {
      // Find the file in current loaded directories if possible to allow clicking
      // Note: If directory is closed, we might not have the handle readily available in 'files' list
      // But we can try to find it.
      let foundFile: FileData | undefined;
      for (const dir of directories) {
        const f = dir.files.find(file => file.name === name);
        if (f) {
          foundFile = f;
          break;
        }
      }
      return { name, progress, file: foundFile };
    });

  return (
    <div className="flex h-screen w-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      
      {/* Fallback Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFallbackScan}
        className="hidden" 
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
      />

      {/* READER OVERLAY */}
      {view === 'reader' && currentFile && (
        <div className="fixed inset-0 z-50">
          <PDFReader 
            fileData={currentFile} 
            initialPage={progressStore[currentFile.name]?.page || 1}
            onClose={() => setView(previousView)}
            onProgressUpdate={handleProgressUpdate}
            lang={lang}
          />
        </div>
      )}

      {/* SIDEBAR */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 z-10 shadow-sm">
        <div className="p-6">
          <h1 className="text-xl font-bold flex items-center gap-2 text-indigo-600">
            <Book className="fill-current" />
            <span>{t.appTitle}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-2">{t.appSubtitle}</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <button 
            onClick={() => setView('library')}
            className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg transition-colors ${view === 'library' ? 'bg-indigo-50 text-indigo-700 font-medium shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <FolderOpen size={18} />
            {t.library}
          </button>
          <button 
            onClick={() => setView('history')}
            className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg transition-colors ${view === 'history' ? 'bg-indigo-50 text-indigo-700 font-medium shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <History size={18} />
            {t.history}
          </button>
        </nav>

        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <div className="text-xs text-gray-400 text-center">
             {t.version} 1.2
          </div>
          <button 
            onClick={() => setLang(l => l === 'en' ? 'zh' : 'en')}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            title="Switch Language"
          >
            <Languages size={14} />
            {lang === 'en' ? '中文' : 'EN'}
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
          <h2 className="text-lg font-semibold text-gray-800">
            {view === 'library' ? t.headerLibrary : t.headerHistory}
          </h2>
          {view === 'library' && (
             <button 
               onClick={handleAddDirectory}
               className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
             >
               <Plus size={16} />
               {t.addDirectory}
             </button>
          )}
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-8 bg-gray-50">
          
          {/* LIBRARY VIEW */}
          {view === 'library' && (
            <div className="max-w-5xl mx-auto">
              {directories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="bg-white p-6 rounded-full shadow-md mb-6">
                    <FolderOpen size={48} className="text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{t.emptyLibraryTitle}</h3>
                  <p className="text-gray-500 max-w-md mb-8">
                    {t.emptyLibraryDesc}
                  </p>
                  <button 
                    onClick={handleAddDirectory}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-md transition-all flex items-center gap-2"
                  >
                    <Plus size={20} />
                    {t.addFirstDirectory}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {directories.map(dir => (
                    <DirectoryRow 
                      key={dir.id}
                      directory={dir}
                      onToggle={toggleDirectory}
                      onRemove={removeDirectory}
                      onVerifyPermission={verifyPermission}
                      onOpenFile={handleOpenFile}
                      lang={lang}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* HISTORY VIEW */}
          {view === 'history' && (
            <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {historyItems.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <History size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>{t.emptyHistory}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {historyItems.map((item, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => item.file && handleOpenFile(item.file)}
                      className={`p-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${item.file ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                      title={!item.file ? t.fileNotAccessible : ""}
                    >
                      <div className="flex items-center gap-4">
                        <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                          <FileText size={20} />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-800">{item.name}</h4>
                          <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                            <Clock size={12} />
                            <span>{t.lastRead}: {formatDate(item.progress.lastRead)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                         <span className="text-sm font-bold text-indigo-600">
                           {Math.round((item.progress.page / item.progress.totalPages) * 100)}%
                         </span>
                         <span className="text-xs text-gray-400">
                           {t.page} {item.progress.page} {t.of} {item.progress.totalPages}
                         </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}