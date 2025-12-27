import React, { useState, useEffect, useCallback } from 'react';
import { 
  Clock, 
  FolderOpen, 
  History,
  Languages,
  Plus,
  FileText
} from 'lucide-react';
import { DirectoryData, FileData, Lang, ReadingProgress, ViewState } from './types';
import { TRANSLATIONS } from './translations';
import { getDirectoryHandles, getProgressStore, removeDirectoryHandle, saveDirectoryHandle, saveProgressStore } from './lib/storage';
import { DirectoryRow } from './components/DirectoryRow';
import { PDFReader } from './components/PDFReader';

// --- Component: Main App ---
const App = () => {
  const [view, setView] = useState<ViewState>('library');
  const [previousView, setPreviousView] = useState<ViewState>('library');
  const [directories, setDirectories] = useState<DirectoryData[]>([]);
  const [currentFile, setCurrentFile] = useState<FileData | null>(null);
  const [progressStore, setProgressStore] = useState<Record<string, ReadingProgress>>({});
  const [lang, setLang] = useState<Lang>('zh');
  const [isInitialized, setIsInitialized] = useState(false);
  const t = TRANSLATIONS[lang];

  // Initialize
  useEffect(() => {
    const initialize = async () => {
      const storedProgress = await getProgressStore();
      setProgressStore(storedProgress);
      await loadPersistedDirectories();
      setIsInitialized(true);
    };
    initialize();
  }, []);

  // Handle URL params after initialization
  useEffect(() => {
    if (!isInitialized) return;

    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const urlView = params.get('view');

    if (urlView === 'library' || urlView === 'history') {
      setView(urlView);
    }

    if (action === 'open_last_read') {
      const openLastRead = async () => {
        const historyItems = (Object.entries(progressStore) as [string, ReadingProgress][])
          .sort(([, a], [, b]) => b.lastRead - a.lastRead);
        
        if (historyItems.length > 0) {
          const lastReadFile = historyItems[0][0];
          
          // We need to scan all directories to find the file handle
          for (const dir of directories) {
            await scanDirectory(dir.id, dir.handle, false);
          }

          setDirectories(prevDirs => {
            let foundFile: FileData | null = null;
            for (const dir of prevDirs) {
              const f = dir.files.find(file => file.name === lastReadFile);
              if (f) {
                foundFile = f;
                break;
              }
            }
            if (foundFile) {
              handleOpenFile(foundFile);
            }
            return prevDirs;
          });
        }
      };
      openLastRead();
    }
  }, [isInitialized]);

  const loadPersistedDirectories = async () => {
    try {
      const handles = await getDirectoryHandles();
      const loadedDirs: DirectoryData[] = [];
      
      for (const [id, handle] of handles) {
        if (await verifyPermission(handle, true)) {
            loadedDirs.push({
              id, name: handle.name, handle: handle,
              isExpanded: false, status: 'connected', files: []
            });
        } else {
            loadedDirs.push({
              id, name: handle.name, handle: handle, 
              isExpanded: false, status: 'need-permission', files: []
            });
        }
      }
      setDirectories(loadedDirs);
    } catch (e) {
      console.error("Failed to load directories from IndexedDB", e);
    }
  };

  const handleAddDirectory = async () => {
    try {
      const handle = await window.showDirectoryPicker();
      const id = `dir-${handle.name}-${Date.now()}`;
      
      await saveDirectoryHandle(id, handle);
      
      const newDir: DirectoryData = {
        id, name: handle.name, handle: handle,
        isExpanded: true, status: 'connected', files: []
      };
      
      setDirectories(prev => [...prev, newDir]);
      scanDirectory(newDir.id, handle); // Scan immediately
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn("Error choosing directory", err);
      }
    }
  };

  const scanDirectory = async (dirId: string, handle: FileSystemDirectoryHandle, updateExpandedState = true) => {
    const store = await getProgressStore();
    const pdfFiles: FileData[] = [];

    try {
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
      
      setDirectories(prev => prev.map(dir => {
        if (dir.id === dirId) {
          const newDir = { ...dir, files: pdfFiles, error: undefined, status: 'connected' };
          if (updateExpandedState) {
            newDir.isExpanded = true;
          }
          return newDir;
        }
        return dir;
      }));

    } catch (e: any) {
      console.error(e);
      setDirectories(prev => prev.map(dir => 
        dir.id === dirId ? { ...dir, error: t.failedScan, status: 'need-permission' } : dir
      ));
    }
  };

  const toggleDirectory = async (id: string) => {
    const dir = directories.find(d => d.id === id);
    if (!dir || dir.status === 'need-permission') return;

    if (!dir.isExpanded) {
      await scanDirectory(id, dir.handle);
    } else {
      setDirectories(prev => prev.map(d => d.id === id ? { ...d, isExpanded: false } : d));
    }
  };

  const verifyPermission = async (handle: FileSystemDirectoryHandle, silent = false): Promise<boolean> => {
    const options: FileSystemHandlePermissionDescriptor = { mode: 'read' };
    // Check if permission is already granted
    if ((await handle.queryPermission(options)) === 'granted') {
      return true;
    }
    // Request permission if not granted
    if (!silent) {
        if ((await handle.requestPermission(options)) === 'granted') {
            return true;
        }
    }
    return false;
  };
  
  const handleReconnect = async (id: string) => {
    const dir = directories.find(d => d.id === id);
    if (!dir) return;

    if (await verifyPermission(dir.handle)) {
        setDirectories(prev => prev.map(d => d.id === id ? { ...d, status: 'connected' } : d));
        await scanDirectory(id, dir.handle);
    }
  };


  const removeDirectory = async (id: string) => {
    const confirmed = confirm(`Are you sure you want to remove this directory from your library?`);
    if (!confirmed) return;
    
    await removeDirectoryHandle(id);
    setDirectories(prev => prev.filter(d => d.id !== id));
  };

  const handleOpenFile = (file: FileData) => {
    setCurrentFile(file);
    setPreviousView(view);
    setView('reader');
  };

  const handleProgressUpdate = useCallback(async (page: number, total: number) => {
    if (!currentFile) return;

    const newProgress: ReadingProgress = {
      page,
      totalPages: total,
      lastRead: Date.now()
    };

    // Use functional updates to avoid dependency on current state
    setProgressStore(prev => {
      const newStore = {
        ...prev,
        [currentFile.name]: newProgress
      };
      saveProgressStore(newStore);
      return newStore;
    });

    // Update state everywhere
    setCurrentFile(prev => prev ? { ...prev, progress: newProgress } : null);
    setDirectories(prev => prev.map(dir => ({
      ...dir,
      files: dir.files.map(f => f.name === currentFile.name ? { ...f, progress: newProgress } : f)
    })));
  }, [currentFile]); // Remove progressStore from dependencies

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  // Flatten all files for History view
  const historyItems = (Object.entries(progressStore) as [string, ReadingProgress][])
    .sort(([, a], [, b]) => b.lastRead - a.lastRead)
    .map(([name, progress]) => {
      let foundFile: FileData | undefined;
      for (const dir of directories) {
        if (dir.status === 'connected') {
            const f = dir.files.find(file => file.name === name);
            if (f) {
              foundFile = f;
              break;
            }
        }
      }
      return { name, progress, file: foundFile };
    });

  return (
    <div className="flex h-screen w-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      
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
            <img src="/icons/icon32.png" alt="PDF Library Icon" className="w-6 h-6" />
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
                      onVerifyPermission={handleReconnect}
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

export default App;
