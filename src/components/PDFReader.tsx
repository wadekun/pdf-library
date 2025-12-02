import * as pdfjsLib from 'pdfjs-dist';
import { ArrowLeft, ZoomOut, ZoomIn, AlertCircle } from 'lucide-react';
import { FileData, Lang } from '../types';
import { TRANSLATIONS } from '../translations';
import { PDFPage } from './PDFPage';

// --- Component: PDF Reader ---
export const PDFReader = ({ 
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
        pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
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
    if (!fileData) return;

    const loadDoc = async () => {
      setLoading(true);
      setError(null);
      setPageDimensions(null);
      initialScrollDone.current = false;

      try {
        if (!fileData.handle) {
            throw new Error(t.cannotAccess);
        }
        const file = await fileData.handle.getFile();

        const arrayBuffer = await file.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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
  }, [fileData, lang]);

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
    } else {
        initialScrollDone.current = true;
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
  }, [pdfDoc, initialPage]);

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
