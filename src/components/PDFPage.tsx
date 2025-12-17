import React, { useState, useEffect, useRef, memo } from 'react';
import { Page } from 'react-pdf';
import { TRANSLATIONS } from '../translations';
import { Lang } from '../types';

// --- Component: PDF Page ---
const PDFPageComponent = ({
  pageNumber,
  scale,
  onVisible,
  lang
}: {
  pageNumber: number;
  scale: number;
  onVisible: (page: number) => void;
  lang: Lang;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const t = TRANSLATIONS[lang];

  // Observer for rendering (Lazy load)
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
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

    let lastTriggered = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
            const now = Date.now();
            // Throttle the callback to prevent multiple rapid calls
            if (now - lastTriggered > 100) {
              lastTriggered = now;
              onVisible(pageNumber);
            }
          }
        });
      },
      { threshold: [0.1, 0.3, 0.5, 0.7] }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  return (
    <div
      ref={containerRef}
      id={`page-${pageNumber}`}
      className="shadow-md mb-4 mx-auto relative bg-white transition-all duration-300"
      style={{
        minHeight: `${792 * scale}px`, // 预设最小高度，避免布局跳动
      }}
    >
      {isVisible && (
        <Page
          key={`${pageNumber}-${scale}`} // 当缩放改变时重新渲染
          pageNumber={pageNumber}
          scale={scale}
          className="block mx-auto"
          renderTextLayer={true}
          renderAnnotationLayer={true}
          onRenderSuccess={() => setIsRendered(true)}
          loading={
            <div className="flex items-center justify-center p-8 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mr-3"></div>
              {t.loading}
            </div>
          }
          error={
            <div className="flex items-center justify-center p-8 text-red-500">
              {t.errorLoading || 'Failed to load page'}
            </div>
          }
        />
      )}
    </div>
  );
};

export const PDFPage = memo(PDFPageComponent);