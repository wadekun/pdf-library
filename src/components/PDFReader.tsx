import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Document, pdfjs } from 'react-pdf';
import { ArrowLeft, ZoomOut, ZoomIn, AlertCircle, List } from 'lucide-react';
import { FileData, Lang, PDFOutlineItem } from '../types';
import { TRANSLATIONS } from '../translations';
import { PDFPage } from './PDFPage';
import { PDFOutline } from './PDFOutline';

// Import CSS for react-pdf
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configure PDF.js worker for Chrome extension
pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');

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
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [documentKey, setDocumentKey] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [outline, setOutline] = useState<PDFOutlineItem[]>([]);
  const [pdfDocument, setPdfDocument] = useState<any>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);
  const t = TRANSLATIONS[lang];

  // Load file when fileData changes
  useEffect(() => {
    if (!fileData) return;

    const loadFile = async () => {
      setLoading(true);
      setError(null);
      initialScrollDone.current = false;
      setOutline([]); // Reset outline

      try {
        if (!fileData.handle) {
            throw new Error(t.cannotAccess);
        }
        const file = await fileData.handle.getFile();
        setFile(file);
        setDocumentKey(`${fileData.id}-${file.lastModified}`);
        setLoading(false);
      } catch (err: any) {
        console.error("File Load Error:", err);
        setError(`${t.errorPdfLoad}: ${err.message}`);
        setLoading(false);
      }
    };
    loadFile();
  }, [fileData?.id]);

  // Handle document load success
  const onDocumentLoadSuccess = useCallback(async (pdf: any) => {
    setNumPages(pdf.numPages);
    setPdfDocument(pdf); // Save PDF instance
    setLoading(false);

    // Get Outline
    try {
      const outlineData = await pdf.getOutline();
      setOutline(outlineData || []);
    } catch (error) {
      console.warn("Failed to load outline", error);
    }

    // Auto-fit Logic
    try {
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
      
      // Calculate scale to fit width with some padding (e.g., 64px total horizontal padding)
      const padding = 64;
      const availableWidth = containerWidth - padding;
      const fitScale = availableWidth / viewport.width;
      
      // Set a reasonable minimum and maximum for auto-fit, and round to 2 decimals
      const targetScale = Math.min(Math.max(fitScale, 0.5), 2.5);
      setScale(Math.round(targetScale * 100) / 100);
    } catch (error) {
      console.error("Error calculating auto-fit scale:", error);
    }
  }, []);

  // Handle document load error
  const onDocumentLoadError = useCallback((error: Error) => {
    console.error("Document Load Error:", error);
    setError(`${t.errorPdfLoad}: ${error.message}`);
    setLoading(false);
  }, [t.errorPdfLoad]);

  // Handle Scroll to Initial Page - only run once when document is loaded
  useEffect(() => {
    if (loading || !numPages || initialScrollDone.current) return;

    if (initialPage > 1) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`page-${initialPage}`);
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
        initialScrollDone.current = true;
      }, 100);
      return () => clearTimeout(timer);
    } else {
      initialScrollDone.current = true;
    }
  }, [loading, numPages, initialPage]);

  const handleScaleChange = (newScale: number) => {
    if (newScale === scale) return;
    setScale(newScale);
  };

  // Smooth-zoom implementation
  const prevScaleRef = useRef(scale);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const oldScale = prevScaleRef.current;
    const newScale = scale;

    // The point in the viewport we want to zoom into (e.g., the center)
    const viewportAnchorY = container.clientHeight / 2;

    // The point in the document that corresponds to the viewport anchor
    const documentAnchorY = container.scrollTop + viewportAnchorY;

    // Calculate the new scroll top to keep the anchor point at the same place
    const newScrollTop = (documentAnchorY * (newScale / oldScale)) - viewportAnchorY;

    container.scrollTop = newScrollTop;

    // Update the ref for the next scale change
    prevScaleRef.current = newScale;
  }, [scale]);

  // Memoized callback to update current page
  const handlePageVisible = useCallback((page: number) => {
    if (initialPage > 1 && !initialScrollDone.current) {
      return;
    }
    if (currentPage !== page) {
      setCurrentPage(page);
      if (numPages) {
        onProgressUpdate(page, numPages);
      }
    }
  }, [currentPage, initialPage, numPages, onProgressUpdate]);

  // Handle Outline Click
  const handleOutlineClick = async (dest: any) => {
    if (!pdfDocument) return;

    try {
      let pageIndex = -1;

      // dest can be a string (named destination) or an array (explicit destination)
      if (typeof dest === 'string') {
        const explicitDest = await pdfDocument.getDestination(dest);
        if (explicitDest) {
            const pageRef = explicitDest[0];
            pageIndex = await pdfDocument.getPageIndex(pageRef);
        }
      } else if (Array.isArray(dest)) {
          const pageRef = dest[0];
          // Usually dest[0] is a Ref object, sometimes it's null (if pointing to current page)
          // or an int. `getPageIndex` handles Ref and int usually.
          pageIndex = await pdfDocument.getPageIndex(pageRef);
      }

      if (pageIndex !== -1) {
        const pageNumber = pageIndex + 1; // Convert 0-based index to 1-based page number
        const el = document.getElementById(`page-${pageNumber}`);
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
      }
    } catch (e) {
      console.error("Navigation failed", e);
    }
  };

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
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className={`p-2 rounded transition-colors ${buttonHoverClass} ${isSidebarOpen ? 'bg-gray-700' : ''}`}
            title="Toggle Outline"
          >
            <List size={20} />
          </button>
          <span className={`font-medium truncate text-sm ${textClass}`}>{fileData.name}</span>
        </div>

        <div className="flex items-center gap-4 justify-center w-1/3">
           <div className="text-sm font-mono px-4 py-1.5 rounded border shadow-inner bg-gray-900 border-gray-700">
            {t.page} {currentPage} / {numPages || '-'}
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end w-1/3">
          <button onClick={() => handleScaleChange(Math.max(0.5, scale - 0.2))} className={`p-2 rounded transition-colors ${buttonHoverClass}`}>
            <ZoomOut size={20} />
          </button>
          <span className={`text-xs w-12 text-center ${textClass}`}>{Math.round(scale * 100)}%</span>
          <button onClick={() => handleScaleChange(Math.min(3.0, scale + 0.2))} className={`p-2 rounded transition-colors ${buttonHoverClass}`}>
            <ZoomIn size={20} />
          </button>
        </div>
      </div>

      {/* Content Body with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar (Outline) */}
        {isSidebarOpen && (
          <div className="w-64 bg-gray-800 border-r border-gray-700 overflow-y-auto shrink-0 transition-all">
            <div className="p-4 text-sm text-gray-300">
               {outline.length > 0 ? (
                 <PDFOutline items={outline} onItemClick={handleOutlineClick} />
               ) : (
                 <div className="text-gray-500 text-center mt-10">
                   {t.noOutline || "No Table of Contents"}
                 </div>
               )}
            </div>
          </div>
        )}

        {/* Main Content (Scrollable) */}
        <div
          ref={containerRef}
          className={`flex-1 overflow-auto relative scroll-smooth ${bgClass} transition-colors duration-300`}
        >
          {loading || !file ? (
            <div className={`absolute inset-0 flex items-center justify-center ${textClass}`}>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
                  <div className="py-8 min-h-full flex flex-col items-center">
                    <Document              key={documentKey}
                file={file}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className={`absolute inset-0 flex items-center justify-center ${textClass}`}>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                  </div>
                }
                error={
                  <div className="flex flex-col items-center justify-center h-full text-red-500 p-8 text-center">
                    <AlertCircle size={48} />
                    <p className="mt-4 text-lg font-semibold">{t.errorLoading}</p>
                  </div>
                }
              >
                {Array.from({ length: numPages || 0 }, (_, i) => i + 1).map((pageNum) => (
                  <PDFPage
                    key={pageNum}
                    pageNumber={pageNum}
                    scale={scale}
                    onVisible={handlePageVisible}
                    lang={lang}
                  />
                ))}
              </Document>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};